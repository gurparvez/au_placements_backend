import { Opening } from '../models/opening.model';
import { Recruiter } from '../models/recruiter.model';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/escapeRegex';

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
}

function toDoc(data: OpeningInput) {
  const doc: Record<string, any> = { ...data };
  if (data.apply_by !== undefined) doc.apply_by = data.apply_by ? new Date(data.apply_by) : undefined;
  if (data.apply_url === '') doc.apply_url = undefined;
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
    return opening.populate('skills');
  }

  async list(filters: ListFilters, page: number, limit: number, skip: number) {
    const query: Record<string, any> = {};
    query.status = filters.status || 'open';
    if (filters.type) query.type = filters.type;
    if (filters.university) query.eligible_universities = filters.university;
    if (filters.skill) query.skills = filters.skill;
    if (filters.q && filters.q.trim()) {
      const rx = new RegExp(escapeRegex(filters.q.trim()), 'i');
      query.$or = [{ title: rx }, { company: rx }, { location: rx }];
    }

    const [openings, total] = await Promise.all([
      Opening.find(query).populate('skills').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Opening.countDocuments(query),
    ]);

    return { openings, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    const opening = await Opening.findById(id)
      .populate('skills')
      .populate('recruiter', 'firstName lastName');
    if (!opening) throw new ApiError(404, 'Opening not found.');
    return opening;
  }

  async listMine(recruiterUserId: string, page: number, limit: number, skip: number) {
    const [openings, total] = await Promise.all([
      Opening.find({ recruiter: recruiterUserId }).populate('skills').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Opening.countDocuments({ recruiter: recruiterUserId }),
    ]);
    return { openings, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
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
    return opening.populate('skills');
  }

  async setStatus(id: string, actor: Actor, status: 'open' | 'closed') {
    const opening = await this.ownedOrThrow(id, actor);
    opening.status = status;
    await opening.save();
    return opening.populate('skills');
  }

  async remove(id: string, actor: Actor) {
    const opening = await this.ownedOrThrow(id, actor);
    await opening.deleteOne();
    return { _id: id };
  }
}
