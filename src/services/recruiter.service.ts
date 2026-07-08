import { User } from '../models/user.model';
import { Recruiter } from '../models/recruiter.model';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/escapeRegex';
import { notificationService } from './notification.service';
import { uploadToCloudinary } from '../utils/uploadToCloudinary';
import { bumpVersion } from '../utils/cache';

// Company fields a recruiter is allowed to edit on their own profile.
const EDITABLE_FIELDS = [
  'company', 'designation', 'company_website', 'industry',
  'company_size', 'location', 'linkedin_url', 'about', 'work_email',
] as const;

interface RecruiterInput {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  password: string;
  company: string;
  designation?: string;
  company_website?: string;
  industry?: string;
  company_size?: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  location?: string;
  linkedin_url?: string;
  about?: string;
  work_email?: string;
}

function shapeUser(user: any) {
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    roles: user.roles,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export class RecruiterService {
  private async createUserAndProfile(data: RecruiterInput, status: 'pending' | 'active') {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new ApiError(409, 'A user with this email already exists.');

    const user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      password: data.password,
      roles: ['recruiter'],
      status,
    });

    const recruiter = await Recruiter.create({
      user: user._id,
      company: data.company,
      designation: data.designation,
      company_website: data.company_website || undefined,
      industry: data.industry,
      company_size: data.company_size,
      location: data.location,
      linkedin_url: data.linkedin_url || undefined,
      about: data.about,
      work_email: data.work_email || undefined,
      phone: data.phone,
    });

    return { user, recruiter };
  }

  /** A recruiter's own company profile (user + recruiter details). */
  async getOwn(userId: string) {
    const recruiter = await Recruiter.findOne({ user: userId });
    if (!recruiter) throw new ApiError(404, 'Company profile not found.');
    const user = await User.findById(userId);
    return { user: user ? shapeUser(user) : null, profile: recruiter };
  }

  /** A recruiter updates their own company profile (optionally a new logo). */
  async updateOwn(userId: string, data: Record<string, any>, logoBuffer?: Buffer) {
    const recruiter = await Recruiter.findOne({ user: userId });
    if (!recruiter) throw new ApiError(404, 'Company profile not found.');

    for (const key of EDITABLE_FIELDS) {
      if (data[key] !== undefined) {
        const v = typeof data[key] === 'string' ? data[key].trim() : data[key];
        (recruiter as any)[key] = v === '' ? undefined : v;
      }
    }
    if (!recruiter.company || !String(recruiter.company).trim()) {
      throw new ApiError(400, 'Company name is required.');
    }

    if (logoBuffer) {
      const result = await uploadToCloudinary(logoBuffer, 'company_logos');
      if (result?.secure_url) recruiter.company_logo = result.secure_url;
    }

    await recruiter.save();
    await bumpVersion('companies'); // directory + profile show updated details
    return recruiter;
  }

  /** Public self-request → pending. */
  async request(data: RecruiterInput) {
    const { user } = await this.createUserAndProfile(data, 'pending');
    return { email: user.email, status: user.status };
  }

  /** Admin creates a recruiter → already active. */
  async createByAdmin(data: RecruiterInput) {
    const { user, recruiter } = await this.createUserAndProfile(data, 'active');
    await bumpVersion('companies'); // new active company enters the directory
    return { user: shapeUser(user), recruiter };
  }

  /** Admin listing of recruiters, optionally filtered by user.status + search. */
  async list(page: number, limit: number, skip: number, status?: string, search?: string) {
    const filter: Record<string, any> = { roles: 'recruiter' };
    if (status) filter.status = status;
    if (search && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(filter).select('-password -__v').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    const recruiters = await Recruiter.find({ user: { $in: users.map((u) => u._id) } });
    const byUser = new Map(recruiters.map((r) => [String(r.user), r]));

    const data = users.map((u) => ({ user: shapeUser(u), recruiter: byUser.get(String(u._id)) || null }));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async approve(recruiterId: string, adminId: string) {
    const recruiter = await Recruiter.findById(recruiterId);
    if (!recruiter) throw new ApiError(404, 'Recruiter not found.');

    const user = await User.findByIdAndUpdate(recruiter.user, { $set: { status: 'active' } }, { new: true }).select('-password -__v');
    if (!user) throw new ApiError(404, 'Linked user not found.');

    recruiter.reviewed_by = adminId as any;
    recruiter.reviewed_at = new Date();
    recruiter.rejection_reason = undefined;
    await recruiter.save();

    await notificationService.create({
      recipient: recruiter.user,
      actor: adminId,
      type: 'recruiter_approved',
      entity: { kind: 'user', id: recruiter.user },
      text: 'approved your recruiter account',
    });

    await bumpVersion('companies'); // now an active company in the directory
    return { user: shapeUser(user), recruiter };
  }

  async reject(recruiterId: string, adminId: string, reason?: string) {
    const recruiter = await Recruiter.findById(recruiterId);
    if (!recruiter) throw new ApiError(404, 'Recruiter not found.');

    const user = await User.findByIdAndUpdate(recruiter.user, { $set: { status: 'rejected' } }, { new: true }).select('-password -__v');
    if (!user) throw new ApiError(404, 'Linked user not found.');

    recruiter.reviewed_by = adminId as any;
    recruiter.reviewed_at = new Date();
    recruiter.rejection_reason = reason;
    await recruiter.save();

    await notificationService.create({
      recipient: recruiter.user,
      actor: adminId,
      type: 'recruiter_rejected',
      entity: { kind: 'user', id: recruiter.user },
      text: 'reviewed your recruiter request',
    });

    await bumpVersion('companies'); // removed from the active directory
    return { user: shapeUser(user), recruiter };
  }
}
