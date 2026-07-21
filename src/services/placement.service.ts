import { Placement } from '../models/placement.model';
import { User } from '../models/user.model';
import { Application } from '../models/application.model';
import { ApiError } from '../utils/ApiError';
import { bumpVersion } from '../utils/cache';
import { emitToUser } from '../config/socket';
import { Notification } from '../models/notification.model';

const EDITABLE = [
  'company', 'role', 'type', 'source', 'location', 'ctc_lpa', 'stipend',
  'offer_date', 'start_date', 'end_date', 'status', 'notes', 'opening', 'application',
] as const;

function pick(body: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k of EDITABLE) if (body[k] !== undefined && body[k] !== '') out[k] = body[k];
  return out;
}

export class PlacementService {
  async list({ page = 1, limit = 20, type, status, q }: {
    page?: number; limit?: number; type?: string; status?: string; q?: string;
  }) {
    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (q) filter.company = { $regex: q, $options: 'i' };

    const [rows, total] = await Promise.all([
      Placement.find(filter)
        .sort({ offer_date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('student', 'firstName lastName auid email university')
        .lean(),
      Placement.countDocuments(filter),
    ]);

    return { data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async create(body: Record<string, any>) {
    const studentId = body.student;
    if (!studentId) throw new ApiError(400, 'student is required');

    const student = await User.findById(studentId).select('roles').lean();
    if (!student) throw new ApiError(404, 'Student not found');
    if (!(student as any).roles?.includes('student')) {
      throw new ApiError(400, 'Placements can only be recorded for students');
    }

    const doc = await Placement.create({ student: studentId, ...pick(body) });
    await bumpVersion('analytics');

    // Let the student know their placement was recorded.
    await Notification.create({
      recipient: studentId,
      type: 'application',
      text: `Your ${doc.type} at ${doc.company} was recorded by the placement cell.`,
    }).catch(() => null);
    emitToUser(String(studentId), 'notification', { type: 'application' });

    return doc;
  }

  async update(id: string, body: Record<string, any>) {
    const doc = await Placement.findByIdAndUpdate(id, { $set: pick(body) }, { new: true, runValidators: true });
    if (!doc) throw new ApiError(404, 'Placement not found');
    await bumpVersion('analytics');
    return doc;
  }

  async remove(id: string) {
    const doc = await Placement.findByIdAndDelete(id);
    if (!doc) throw new ApiError(404, 'Placement not found');
    await bumpVersion('analytics');
    return { _id: id };
  }

  /** Placements for one student — shown on their profile. */
  async listByStudent(studentUserId: string) {
    return Placement.find({ student: studentUserId }).sort({ offer_date: -1, createdAt: -1 }).lean();
  }

  /**
   * Promote a shortlisted application into a placement record in one step —
   * the common TPO action after a recruiter marks someone selected.
   */
  async fromApplication(applicationId: string, body: Record<string, any>) {
    const app = await Application.findById(applicationId).populate('opening').lean();
    if (!app) throw new ApiError(404, 'Application not found');

    const opening: any = (app as any).opening;
    const doc = await Placement.create({
      student: (app as any).student,
      application: app._id,
      opening: opening?._id,
      company: body.company ?? opening?.company ?? 'Unknown',
      role: body.role ?? opening?.title ?? 'Unknown',
      type: body.type ?? (opening?.type === 'internship' ? 'internship' : 'job'),
      ...pick(body),
    });

    await Application.findByIdAndUpdate(applicationId, { $set: { status: 'accepted' } });
    await bumpVersion('analytics');
    return doc;
  }
}

export const placementService = new PlacementService();
