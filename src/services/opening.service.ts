import { Opening } from '../models/opening.model';
import { Recruiter } from '../models/recruiter.model';
import { Application, APPLICATION_STAGES, ROUND_RESULTS, type RoundResult } from '../models/application.model';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/escapeRegex';
import { notificationService } from './notification.service';
import { eligibilityService } from './eligibility.service';
import { cached, bumpVersion } from '../utils/cache';
import { CONFIG } from '../config/environment';

const OPENINGS_NS = 'openings';

interface OpeningInput {
  title?: string;
  description?: string;
  type?: 'internship' | 'job';
  work_mode?: 'onsite' | 'remote' | 'hybrid';
  location?: string;
  skills?: string[];
  eligible_universities?: ('Akal University' | 'Eternal University')[];
  min_experience?: number;
  stipend_or_salary?: string;
  apply_url?: string;
  apply_by?: string;
  company?: string;

  min_cgpa?: number;
  max_backlogs?: number;
  eligible_departments?: string[];
  eligible_batches?: number[];
  allow_placed?: boolean;
  tier?: 'regular' | 'core' | 'dream';
  ctc_lpa?: number;
  rounds?: { name: string; order: number }[];
}

interface Actor {
  _id: any;
  roles: string[];
}

interface ListFilters {
  q?: string;
  type?: string;
  university?: string;
  skill?: string;
  status?: string;
  recruiter?: string;
}

function toDoc(data: OpeningInput) {
  const doc: Record<string, any> = { ...data };
  if (data.apply_by !== undefined) doc.apply_by = data.apply_by ? new Date(data.apply_by) : undefined;
  if (data.apply_url === '') doc.apply_url = undefined;
  // Renumber rounds so `order` is always 1..n and matches array position.
  if (Array.isArray(data.rounds)) {
    doc.rounds = data.rounds
      .filter((r) => r?.name?.trim())
      .map((r, i) => ({ name: r.name.trim(), order: i + 1 }));
  }
  delete doc.company; // company is denormalized separately, never taken raw on update
  return doc;
}

export class OpeningService {
  async create(recruiterUserId: string, data: OpeningInput) {
    const recruiter = await Recruiter.findOne({ user: recruiterUserId });
    const company = recruiter?.company || data.company;
    if (!company) throw new ApiError(400, 'Company is required.');

    const opening = await Opening.create({
      ...toDoc(data),
      recruiter: recruiterUserId,
      company,
    });
    await bumpVersion(OPENINGS_NS);
    return opening.populate('skills');
  }

  // SHARED (cacheable): application_count is identical for every viewer.
  private async decorateCounts(openings: any[]) {
    if (!openings.length) return [];
    const ids = openings.map((o) => o._id);
    const counts = await Application.aggregate([
      { $match: { opening: { $in: ids } } },
      { $group: { _id: '$opening', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c: any) => [String(c._id), c.count]));
    return openings.map((o) => {
      const plain = o.toObject ? o.toObject() : o;
      return { ...plain, application_count: countMap.get(String(o._id)) || 0 };
    });
  }

  // PER-VIEWER (never cached): a cheap indexed lookup layered over the shared cache,
  // so one student's application doesn't invalidate the list for everyone else.
  private async applyHasApplied(list: any[], viewerId?: string) {
    if (!viewerId || !list.length) return list.map((o) => ({ ...o, has_applied: false }));
    const ids = list.map((o) => o._id);
    const mine = await Application.find({ opening: { $in: ids }, student: viewerId }).select('opening').lean();
    const applied = new Set(mine.map((a: any) => String(a.opening)));
    return list.map((o) => ({ ...o, has_applied: applied.has(String(o._id)) }));
  }

  async list(filters: ListFilters, page: number, limit: number, skip: number, viewerId?: string) {
    // Shared list (no viewer in the key) → one cache entry serves all users.
    const shared = await cached(
      OPENINGS_NS,
      ['list', filters.status, filters.type, filters.university, filters.skill, filters.recruiter, filters.q?.trim().toLowerCase(), page, limit],
      CONFIG.cache.defaultTtl,
      async () => {
        const query: Record<string, any> = {};
        query.status = filters.status || 'open';
        if (filters.type) query.type = filters.type;
        if (filters.university) query.eligible_universities = filters.university;
        if (filters.skill) query.skills = filters.skill;
        if (filters.recruiter) query.recruiter = filters.recruiter;
        if (filters.q && filters.q.trim()) {
          const rx = new RegExp(escapeRegex(filters.q.trim()), 'i');
          query.$or = [{ title: rx }, { company: rx }, { location: rx }];
        }

        const [openings, total] = await Promise.all([
          Opening.find(query).populate('skills').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
          Opening.countDocuments(query),
        ]);

        return { openings: await this.decorateCounts(openings), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
      }
    );
    return { openings: await this.applyHasApplied(shared.openings, viewerId), pagination: shared.pagination };
  }

  async getById(id: string, viewerId?: string) {
    const shared = await cached(OPENINGS_NS, ['one', id], CONFIG.cache.defaultTtl, async () => {
      const opening = await Opening.findById(id)
        .populate('skills')
        .populate('recruiter', 'firstName lastName')
        .lean();
      if (!opening) throw new ApiError(404, 'Opening not found.');
      return (await this.decorateCounts([opening]))[0];
    });
    return (await this.applyHasApplied([shared], viewerId))[0];
  }

  async listMine(recruiterUserId: string, page: number, limit: number, skip: number) {
    const [openings, total] = await Promise.all([
      Opening.find({ recruiter: recruiterUserId }).populate('skills').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Opening.countDocuments({ recruiter: recruiterUserId }),
    ]);
    return { openings: await this.decorateCounts(openings), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * A student applies to an open opening. Duplicate → 409. Eligibility and the
   * university's offer policy are enforced here, not just hidden in the UI —
   * the rejection message names every failing criterion.
   */
  async apply(openingId: string, studentUserId: string) {
    const opening = await Opening.findById(openingId);
    if (!opening) throw new ApiError(404, 'Opening not found.');
    if (opening.status !== 'open') throw new ApiError(400, 'This opening is no longer accepting applications.');

    const existing = await Application.findOne({ opening: openingId, student: studentUserId });
    if (existing) throw new ApiError(409, 'You have already applied to this opening.');

    const { eligible, reasons } = await eligibilityService.check(openingId, studentUserId);
    if (!eligible) {
      throw new ApiError(403, `You are not eligible: ${reasons.map((r) => r.message).join('; ')}`);
    }

    // Seed the round pipeline from the opening so progress is trackable.
    const rounds = (opening.rounds ?? []).map((r: any) => ({
      name: r.name, order: r.order, result: 'pending' as const,
    }));

    await Application.create({
      opening: openingId,
      student: studentUserId,
      recruiter: opening.recruiter,
      rounds,
      current_round: 0,
    });

    await notificationService.create({
      recipient: opening.recruiter,
      actor: studentUserId,
      type: 'application',
      entity: { kind: 'opening', id: opening._id },
      text: `applied to your opening "${opening.title}"`,
    });

    const application_count = await Application.countDocuments({ opening: openingId });
    await bumpVersion(OPENINGS_NS); // application_count / has_applied changed
    await bumpVersion('analytics'); // funnel counts changed
    return { applied: true, application_count };
  }

  /** The opening owner (or admin) lists who applied. */
  async listApplicants(openingId: string, actor: Actor) {
    await this.ownedOrThrow(openingId, actor);
    const apps = await Application.find({ opening: openingId })
      .populate('student', 'firstName lastName auid university')
      .sort({ createdAt: -1 });
    return apps.map((a: any) => ({
      _id: a._id,
      status: a.status,
      appliedAt: a.createdAt,
      rounds: a.rounds ?? [],
      current_round: a.current_round ?? 0,
      student: a.student
        ? { _id: a.student._id, firstName: a.student.firstName, lastName: a.student.lastName, auid: a.student.auid, university: a.student.university }
        : null,
    }));
  }

  /**
   * The opening owner (or admin) moves an applicant along the pipeline.
   * The student is notified of every stage change.
   */
  async setApplicantStatus(openingId: string, applicationId: string, actor: Actor, status: string) {
    if (!(APPLICATION_STAGES as readonly string[]).includes(status)) {
      throw new ApiError(400, 'Invalid application status.');
    }
    const opening = await this.ownedOrThrow(openingId, actor);

    const app = await Application.findOneAndUpdate(
      { _id: applicationId, opening: openingId },
      { $set: { status } },
      { new: true }
    );
    if (!app) throw new ApiError(404, 'Application not found.');

    await notificationService.create({
      recipient: app.student,
      actor: actor._id,
      type: 'application',
      entity: { kind: 'opening', id: opening._id },
      text: `updated your application for "${opening.title}" to ${status}`,
    });

    await bumpVersion(OPENINGS_NS);
    await bumpVersion('analytics');
    return { _id: app._id, status: app.status };
  }

  /**
   * Record a round outcome for one applicant. A failed/absent round ends the
   * application, so the flat status is kept in sync automatically — the TPO
   * shouldn't have to update two things.
   */
  async setRoundResult(
    openingId: string,
    applicationId: string,
    actor: Actor,
    roundOrder: number,
    result: RoundResult,
    notes?: string
  ) {
    if (!(ROUND_RESULTS as readonly string[]).includes(result)) {
      throw new ApiError(400, 'Invalid round result.');
    }
    const opening = await this.ownedOrThrow(openingId, actor);

    const app = await Application.findOne({ _id: applicationId, opening: openingId });
    if (!app) throw new ApiError(404, 'Application not found.');

    const round = (app.rounds ?? []).find((r: any) => r.order === roundOrder);
    if (!round) throw new ApiError(404, 'That round is not part of this application.');

    round.result = result;
    round.date = new Date();
    if (notes !== undefined) round.notes = notes;

    if (result === 'cleared') {
      app.current_round = Math.max(app.current_round ?? 0, roundOrder);
      const total = (app.rounds ?? []).length;
      // Clearing the final round means an offer.
      app.status = roundOrder >= total ? 'offered' : 'interviewed';
    } else if (result === 'failed' || result === 'absent') {
      app.status = 'rejected';
    }

    await app.save();

    await notificationService.create({
      recipient: app.student,
      actor: actor._id,
      type: 'application',
      entity: { kind: 'opening', id: opening._id },
      text: `marked you ${result} in "${round.name}" for ${opening.title}`,
    });

    await bumpVersion(OPENINGS_NS);
    await bumpVersion('analytics');
    return { _id: app._id, status: app.status, current_round: app.current_round, rounds: app.rounds };
  }

  private async ownedOrThrow(id: string, actor: Actor) {
    const opening = await Opening.findById(id);
    if (!opening) throw new ApiError(404, 'Opening not found.');
    const isOwner = String(opening.recruiter) === String(actor._id);
    const isAdmin = actor.roles.includes('admin');
    if (!isOwner && !isAdmin) throw new ApiError(403, 'You can only manage your own openings.');
    return opening;
  }

  async update(id: string, actor: Actor, data: OpeningInput) {
    const opening = await this.ownedOrThrow(id, actor);
    Object.assign(opening, toDoc(data));
    await opening.save();
    await bumpVersion(OPENINGS_NS);
    return opening.populate('skills');
  }

  async setStatus(id: string, actor: Actor, status: 'open' | 'closed') {
    const opening = await this.ownedOrThrow(id, actor);
    opening.status = status;
    await opening.save();
    await bumpVersion(OPENINGS_NS);
    return opening.populate('skills');
  }

  async remove(id: string, actor: Actor) {
    const opening = await this.ownedOrThrow(id, actor);
    await opening.deleteOne();
    await bumpVersion(OPENINGS_NS);
    return { _id: id };
  }
}
