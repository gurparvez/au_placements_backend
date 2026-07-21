import { PlacementPolicy, getPolicy } from '../models/policy.model';
import { Invitation, INVITATION_STAGES } from '../models/invitation.model';
import { Student } from '../models/student.model';
import { ApiError } from '../utils/ApiError';
import { bumpVersion } from '../utils/cache';
import { currentSession } from './analytics.service';

/** Placement-policy settings and company outreach — the TPO's own tooling. */

const POLICY_FIELDS = [
  'one_offer_lock', 'allow_upgrade_to_higher_tier', 'dream_ctc_threshold',
  'max_offers_per_student', 'default_min_cgpa', 'default_max_backlogs', 'session_start_month',
] as const;

const INVITATION_FIELDS = [
  'company', 'sector', 'contact_name', 'contact_email', 'session',
  'stage', 'is_repeat', 'invited_at', 'responded_at', 'visit_date', 'hires', 'notes',
] as const;

function pick<T extends readonly string[]>(body: Record<string, any>, fields: T) {
  const out: Record<string, any> = {};
  for (const k of fields) if (body[k] !== undefined && body[k] !== '') out[k] = body[k];
  return out;
}

export class TpoService {
  /* ------------------------------ policy ------------------------------ */

  async getPolicy() {
    return getPolicy();
  }

  async updatePolicy(body: Record<string, any>) {
    await getPolicy(); // ensure the singleton exists
    const doc = await PlacementPolicy.findOneAndUpdate(
      { key: 'default' },
      { $set: pick(body, POLICY_FIELDS) },
      { new: true, runValidators: true }
    );
    // Policy changes who is eligible and how rates are computed.
    await Promise.all([bumpVersion('analytics'), bumpVersion('openings')]);
    return doc;
  }

  /* ---------------------------- invitations ---------------------------- */

  async listInvitations({ session, stage, q }: { session?: number; stage?: string; q?: string }) {
    const filter: Record<string, any> = {};
    if (session) filter.session = session;
    if (stage) filter.stage = stage;
    if (q) filter.company = { $regex: q, $options: 'i' };
    return Invitation.find(filter).sort({ session: -1, company: 1 }).lean();
  }

  async createInvitation(body: Record<string, any>) {
    if (!body.company) throw new ApiError(400, 'Company is required.');
    const session = Number(body.session) || currentSession();

    // A company seen in any earlier session is a repeat recruiter.
    const seenBefore = await Invitation.exists({
      company: body.company.trim(),
      session: { $lt: session },
    });

    const existing = await Invitation.findOne({ company: body.company.trim(), session });
    if (existing) throw new ApiError(409, 'This company is already tracked for that session.');

    const doc = await Invitation.create({
      ...pick(body, INVITATION_FIELDS),
      company: body.company.trim(),
      session,
      is_repeat: !!seenBefore,
    });
    await bumpVersion('analytics');
    return doc;
  }

  async updateInvitation(id: string, body: Record<string, any>) {
    const update = pick(body, INVITATION_FIELDS);
    if (update.stage && !(INVITATION_STAGES as readonly string[]).includes(update.stage)) {
      throw new ApiError(400, 'Invalid stage.');
    }
    // Stamp the timestamp that matches the stage being set.
    if (update.stage === 'responded' && !update.responded_at) update.responded_at = new Date();
    if (update.stage === 'visited' && !update.visit_date) update.visit_date = new Date();

    const doc = await Invitation.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!doc) throw new ApiError(404, 'Invitation not found.');
    await bumpVersion('analytics');
    return doc;
  }

  async removeInvitation(id: string) {
    const doc = await Invitation.findByIdAndDelete(id);
    if (!doc) throw new ApiError(404, 'Invitation not found.');
    await bumpVersion('analytics');
    return { _id: id };
  }

  /* ------------------------- student prep data ------------------------- */

  /** TPO-owned academic + readiness fields. Students must not self-edit these. */
  async updateStudentRecord(studentUserId: string, body: Record<string, any>) {
    const fields = [
      'department', 'batch_year', 'cgpa', 'backlogs', 'placement_intent', 'opted_out_reason',
      'aptitude_score', 'mock_interviews', 'mock_interview_score', 'training_attendance', 'resume_verified',
    ];
    const update = pick(body, fields as any);
    if (!Object.keys(update).length) throw new ApiError(400, 'Nothing to update.');

    const doc = await Student.findOneAndUpdate(
      { user: studentUserId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!doc) throw new ApiError(404, 'Student profile not found.');
    await Promise.all([bumpVersion('students'), bumpVersion('analytics')]);
    return doc;
  }
}

export const tpoService = new TpoService();
