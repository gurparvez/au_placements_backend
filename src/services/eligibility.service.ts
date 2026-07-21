import { Student } from '../models/student.model';
import { Placement, ACCEPTED_STATUSES } from '../models/placement.model';
import { Opening, OPENING_TIERS, type OpeningTier } from '../models/opening.model';
import { getPolicy, type IPlacementPolicy } from '../models/policy.model';
import { ApiError } from '../utils/ApiError';

/**
 * Eligibility + placement-policy engine.
 *
 * Two distinct gates, deliberately kept separate:
 *   1. ELIGIBILITY — does the student meet the recruiter's academic criteria?
 *   2. POLICY      — does the university's offer-lock allow them to sit at all?
 *
 * Both return *reasons*, never a bare boolean: an ineligible student must be
 * told precisely why, and the TPO needs the per-criterion breakdown to build
 * the eligibility waterfall (and to negotiate a cutoff down with a recruiter).
 */

export type EligibilityReasonCode =
  | 'cgpa' | 'backlogs' | 'department' | 'batch' | 'university'
  | 'experience' | 'closed' | 'deadline'
  | 'already_placed' | 'offer_lock' | 'offer_cap' | 'opted_out';

export interface EligibilityReason {
  code: EligibilityReasonCode;
  message: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
}

const tierRank = (t?: OpeningTier) => Math.max(0, OPENING_TIERS.indexOf(t ?? 'regular'));

/** Effective tier — an explicit tier wins, else infer from advertised CTC. */
export function effectiveTier(opening: any, policy: IPlacementPolicy): OpeningTier {
  if (opening.tier && opening.tier !== 'regular') return opening.tier;
  if (opening.ctc_lpa && opening.ctc_lpa >= policy.dream_ctc_threshold) return 'dream';
  return opening.tier ?? 'regular';
}

export class EligibilityService {
  /** Academic criteria only — no policy, no offer history. */
  checkAcademic(opening: any, student: any, user: any, policy: IPlacementPolicy): EligibilityReason[] {
    const reasons: EligibilityReason[] = [];

    const minCgpa = opening.min_cgpa ?? policy.default_min_cgpa;
    if (minCgpa > 0) {
      if (student?.cgpa == null) {
        reasons.push({ code: 'cgpa', message: `CGPA not on record (requires ${minCgpa}+)` });
      } else if (student.cgpa < minCgpa) {
        reasons.push({ code: 'cgpa', message: `CGPA ${student.cgpa} is below the ${minCgpa} cutoff` });
      }
    }

    const maxBacklogs = opening.max_backlogs ?? policy.default_max_backlogs;
    if ((student?.backlogs ?? 0) > maxBacklogs) {
      reasons.push({ code: 'backlogs', message: `${student.backlogs} active backlogs (max ${maxBacklogs})` });
    }

    const depts: string[] = opening.eligible_departments ?? [];
    if (depts.length && (!student?.department || !depts.includes(student.department))) {
      reasons.push({ code: 'department', message: `Open to ${depts.join(', ')} only` });
    }

    const batches: number[] = opening.eligible_batches ?? [];
    if (batches.length && (!student?.batch_year || !batches.includes(student.batch_year))) {
      reasons.push({ code: 'batch', message: `Open to batch ${batches.join(', ')} only` });
    }

    const unis: string[] = opening.eligible_universities ?? [];
    if (unis.length && (!user?.university || !unis.includes(user.university))) {
      reasons.push({ code: 'university', message: `Open to ${unis.join(', ')} only` });
    }

    if (opening.min_experience && (student?.total_experience ?? 0) < opening.min_experience) {
      reasons.push({
        code: 'experience',
        message: `Requires ${opening.min_experience} months experience`,
      });
    }

    return reasons;
  }

  /**
   * University policy: offer lock, tier upgrades, offer cap, opt-out.
   * `accepted` is the student's existing confirmed offers.
   */
  checkPolicy(opening: any, student: any, accepted: any[], policy: IPlacementPolicy): EligibilityReason[] {
    const reasons: EligibilityReason[] = [];

    if (student?.placement_intent && student.placement_intent !== 'placement') {
      reasons.push({
        code: 'opted_out',
        message: 'You are not registered for placements — update your profile to opt back in',
      });
    }

    if (!accepted.length) return reasons;

    if (policy.max_offers_per_student > 0 && accepted.length >= policy.max_offers_per_student) {
      reasons.push({
        code: 'offer_cap',
        message: `You already hold ${accepted.length} offer(s); the cap is ${policy.max_offers_per_student}`,
      });
      return reasons;
    }

    if (!policy.one_offer_lock) return reasons;
    if (opening.allow_placed) return reasons; // recruiter explicitly opened it up

    const thisTier = tierRank(effectiveTier(opening, policy));
    const bestHeld = Math.max(...accepted.map((p) => tierRank(p.tier ?? 'regular')));

    // Upgrading is allowed only to a strictly higher tier than what they hold.
    if (policy.allow_upgrade_to_higher_tier && thisTier > bestHeld) return reasons;

    reasons.push({
      code: policy.allow_upgrade_to_higher_tier ? 'offer_lock' : 'already_placed',
      message: policy.allow_upgrade_to_higher_tier
        ? `You already hold a ${OPENING_TIERS[bestHeld]}-tier offer; only higher-tier drives are open to you`
        : 'You already hold a confirmed offer',
    });
    return reasons;
  }

  /** Full check for one student against one opening. */
  async check(openingId: string, studentUserId: string): Promise<EligibilityResult> {
    const [opening, student, policy] = await Promise.all([
      Opening.findById(openingId).lean(),
      Student.findOne({ user: studentUserId }).populate('user', 'university').lean(),
      getPolicy(),
    ]);

    if (!opening) throw new ApiError(404, 'Opening not found.');

    const reasons: EligibilityReason[] = [];
    if (opening.status !== 'open') {
      reasons.push({ code: 'closed', message: 'This opening is no longer accepting applications' });
    }
    if (opening.apply_by && new Date(opening.apply_by) < new Date()) {
      reasons.push({ code: 'deadline', message: 'The application deadline has passed' });
    }

    if (!student) {
      return {
        eligible: false,
        reasons: [...reasons, { code: 'cgpa', message: 'Create your student profile first' }],
      };
    }

    const accepted = await this.acceptedOffers(studentUserId);

    reasons.push(
      ...this.checkAcademic(opening, student, (student as any).user, policy),
      ...this.checkPolicy(opening, student, accepted, policy)
    );

    return { eligible: reasons.length === 0, reasons };
  }

  /** A student's confirmed offers, with the tier of the opening they came from. */
  private async acceptedOffers(studentUserId: string) {
    const rows = await Placement.find({
      student: studentUserId,
      status: { $in: ACCEPTED_STATUSES },
      type: { $in: ['job', 'ppo'] },
    })
      .populate('opening', 'tier ctc_lpa')
      .lean();

    return rows.map((p: any) => ({ tier: p.opening?.tier ?? 'regular', ctc_lpa: p.ctc_lpa }));
  }

  /**
   * Eligibility waterfall for one opening: how many students survive each
   * criterion, applied cumulatively in the order a TPO would explain it.
   * This is what tells us which cutoff is costing the most candidates.
   */
  async waterfall(openingId: string) {
    const [opening, policy] = await Promise.all([Opening.findById(openingId).lean(), getPolicy()]);
    if (!opening) throw new ApiError(404, 'Opening not found.');

    const students = await Student.find({})
      .select('cgpa backlogs department batch_year total_experience placement_intent user')
      .populate('user', 'university roles')
      .lean();

    const pool = students.filter((s: any) => s.user?.roles?.includes('student'));

    const placedIds = new Set(
      (await Placement.distinct('student', {
        status: { $in: ACCEPTED_STATUSES },
        type: { $in: ['job', 'ppo'] },
      })).map(String)
    );

    const minCgpa = opening.min_cgpa ?? policy.default_min_cgpa;
    const maxBacklogs = opening.max_backlogs ?? policy.default_max_backlogs;
    const depts: string[] = opening.eligible_departments ?? [];
    const batches: number[] = opening.eligible_batches ?? [];
    const unis: string[] = opening.eligible_universities ?? [];

    // Each step filters the survivors of the previous one.
    const steps: { key: string; label: string; test: (s: any) => boolean }[] = [
      { key: 'registered', label: 'Registered for placement', test: (s) => (s.placement_intent ?? 'placement') === 'placement' },
      { key: 'university', label: unis.length ? `University: ${unis.map((u) => u.replace(' University', '')).join('/')}` : 'University', test: (s) => !unis.length || unis.includes(s.user?.university) },
      { key: 'batch', label: batches.length ? `Batch ${batches.join('/')}` : 'Batch', test: (s) => !batches.length || batches.includes(s.batch_year) },
      { key: 'department', label: depts.length ? `Department (${depts.length} allowed)` : 'Department', test: (s) => !depts.length || depts.includes(s.department) },
      { key: 'cgpa', label: minCgpa > 0 ? `CGPA ≥ ${minCgpa}` : 'CGPA', test: (s) => !minCgpa || (s.cgpa ?? -1) >= minCgpa },
      { key: 'backlogs', label: `Backlogs ≤ ${maxBacklogs}`, test: (s) => (s.backlogs ?? 0) <= maxBacklogs },
      { key: 'not_placed', label: opening.allow_placed ? 'Offer policy (open to placed)' : 'Not already placed', test: (s) => opening.allow_placed || !placedIds.has(String(s.user?._id)) },
    ];

    const rows = [{ key: 'total', label: 'All students', count: pool.length, lost: 0 }];
    let survivors = pool;
    for (const step of steps) {
      const next = survivors.filter(step.test);
      rows.push({ key: step.key, label: step.label, count: next.length, lost: survivors.length - next.length });
      survivors = next;
    }

    return {
      opening: { _id: opening._id, title: opening.title, company: opening.company },
      criteria: {
        min_cgpa: minCgpa, max_backlogs: maxBacklogs,
        departments: depts, batches, universities: unis,
        allow_placed: !!opening.allow_placed,
      },
      steps: rows,
      eligible: survivors.length,
    };
  }

  /** Ids of every student eligible for an opening — powers "notify eligible". */
  async eligibleStudentIds(openingId: string): Promise<string[]> {
    const wf = await this.waterfall(openingId);
    // waterfall() already applied every filter; re-run cheaply for the id list.
    const [opening, policy] = await Promise.all([Opening.findById(openingId).lean(), getPolicy()]);
    if (!opening) return [];

    const students = await Student.find({})
      .select('cgpa backlogs department batch_year placement_intent user')
      .populate('user', 'university roles')
      .lean();

    const placedIds = new Set(
      (await Placement.distinct('student', {
        status: { $in: ACCEPTED_STATUSES },
        type: { $in: ['job', 'ppo'] },
      })).map(String)
    );

    void wf;
    return students
      .filter((s: any) => {
        if (!s.user?.roles?.includes('student')) return false;
        const acad = this.checkAcademic(opening, s, s.user, policy);
        if (acad.length) return false;
        if ((s.placement_intent ?? 'placement') !== 'placement') return false;
        if (!opening.allow_placed && placedIds.has(String(s.user._id))) return false;
        return true;
      })
      .map((s: any) => String(s.user._id));
  }
}

export const eligibilityService = new EligibilityService();
