import { Student } from '../models/student.model';
import { User } from '../models/user.model';
import { Skill } from '../models/skill.model';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/escapeRegex';
import { uploadToCloudinary } from '../utils/uploadToCloudinary';
import { cached, bumpVersion } from '../utils/cache';
import { CONFIG } from '../config/environment';

const STUDENTS_NS = 'students';

export interface BrowseFilters {
  q?: string;
  skills?: string[];       // skill display names (AND — student must have all)
  university?: string;
  opportunity?: 'internship' | 'job';
  field?: string;
  exp?: '0-6' | '6-12' | '12-24' | '24+';
  from?: string;           // 'YYYY-MM' availability window start
  to?: string;             // 'YYYY-MM' availability window end
}

export class StudentService {
  private parseJsonFields(data: Record<string, any>, fields: string[]) {
    fields.forEach((field) => {
      if (data[field] && typeof data[field] === 'string') {
        try {
          data[field] = JSON.parse(data[field]);
        } catch {
          // Let Mongoose validation catch invalid structures
        }
      }
    });
    return data;
  }

  private async handleFileUploads(
    files: { [fieldname: string]: Express.Multer.File[] } | undefined,
    data: Record<string, any>
  ) {
    if (files?.['profile_image']?.[0]) {
      const uploaded: any = await uploadToCloudinary(files['profile_image'][0].buffer, 'students/profile_images');
      if (uploaded?.secure_url) data.profile_image = uploaded.secure_url;
    }
    if (files?.['resume']?.[0]) {
      const uploaded: any = await uploadToCloudinary(files['resume'][0].buffer, 'students/resumes');
      if (uploaded?.secure_url) data.resume_link = uploaded.secure_url;
    }
    return data;
  }

  async createProfile(userId: string, body: Record<string, any>, files?: { [fieldname: string]: Express.Multer.File[] }) {
    const existing = await Student.findOne({ user: userId });
    if (existing) throw new ApiError(400, 'Profile already exists');

    let studentData = { ...body };
    studentData = await this.handleFileUploads(files, studentData);
    studentData = this.parseJsonFields(studentData, ['education', 'experience', 'projects', 'certificates', 'skills', 'looking_for']);

    const profile = await Student.create({ user: userId, ...studentData });
    await bumpVersion(STUDENTS_NS); // new profile appears in the directory
    return profile;
  }

  async getProfile(userId: string) {
    return Student.findOne({ user: userId }).populate('skills').populate('education.course');
  }

  async getProfileByUserId(userId: string) {
    const profile = await Student.findOne({ user: userId }).populate('skills').populate('education.course');
    if (!profile) throw new ApiError(404, 'Profile not found');

    // Phone is private — never expose it on a student's public profile.
    const user = await User.findById(userId).select('-password -__v -phone');
    return { user, profile };
  }

  async updateProfile(userId: string, body: Record<string, any>, files?: { [fieldname: string]: Express.Multer.File[] }) {
    let updateData: any = { ...body };
    updateData = await this.handleFileUploads(files, updateData);
    updateData = this.parseJsonFields(updateData, ['education', 'experience', 'projects', 'certificates', 'skills', 'looking_for']);

    const updated = await Student.findOneAndUpdate(
      { user: userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) throw new ApiError(404, 'Student profile not found');
    await bumpVersion(STUDENTS_NS); // directory card may have changed
    return updated;
  }

  async searchStudents(q: string, limit = 8) {
    const term = (q || '').trim();
    if (!term) return [];
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tokens = term.split(/\s+/).filter(Boolean).slice(0, 4);
    const and = tokens.map((tok) => {
      const rx = new RegExp(escape(tok), 'i');
      return { $or: [{ auid: rx }, { firstName: rx }, { lastName: rx }] };
    });
    return User.find({ roles: 'student', $and: and })
      .select('_id firstName lastName auid university roles')
      .limit(limit);
  }

  /**
   * Server-side directory: filter + sort + paginate entirely in MongoDB via an
   * aggregation, so the frontend never loads the whole collection. Joins users
   * (name/university search) and skills (skill-name search) in one round trip.
   */
  async browseStudents(filters: BrowseFilters, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const cacheParts = [
      'browse', filters.q?.trim().toLowerCase(), (filters.skills || []).map((s) => s.toLowerCase()).sort().join(','),
      filters.university, filters.opportunity, filters.field, filters.exp, filters.from, filters.to, page, limit,
    ];

    return cached(STUDENTS_NS, cacheParts, CONFIG.cache.defaultTtl, async () => {
      // Resolve skill names → ids up front so we can filter on the raw Student
      // (indexed array) before any $lookup. Missing skill ⇒ no student has it ⇒ empty.
      let skillIds: any[] | null = null;
      if (filters.skills && filters.skills.length) {
        const names = Array.from(new Set(filters.skills.map((s) => s.trim().toLowerCase())));
        const found = await Skill.find({ name: { $in: names } }).select('_id').lean();
        if (found.length < names.length) {
          return { students: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }
        skillIds = found.map((f) => f._id);
      }

      // Student-only conditions applied BEFORE the joins to shrink the working set.
      const pre: Record<string, any> = {};
      if (filters.opportunity) pre['looking_for.type'] = filters.opportunity;
      if (filters.field) pre.preferred_field = filters.field;
      if (skillIds) pre.skills = { $all: skillIds };
      if (filters.exp) {
        pre.total_experience =
          filters.exp === '0-6' ? { $lt: 6 } :
          filters.exp === '6-12' ? { $gte: 6, $lt: 12 } :
          filters.exp === '12-24' ? { $gte: 12, $lt: 24 } : { $gte: 24 };
      }
      const avail: Record<string, any> = {};
      if (filters.from) avail._availTo = { $gte: filters.from };
      if (filters.to) avail._availFrom = { $lte: filters.to };

      const rx = filters.q?.trim() ? new RegExp(escapeRegex(filters.q.trim()), 'i') : null;

      const pipeline: any[] = [
        {
          $addFields: {
            _availFrom: { $ifNull: [{ $dateToString: { format: '%Y-%m', date: '$looking_for.from_date' } }, ''] },
            _availTo: { $ifNull: [{ $dateToString: { format: '%Y-%m', date: '$looking_for.to_date' } }, '9999-12'] },
          },
        },
        ...(Object.keys(pre).length ? [{ $match: pre }] : []),
        ...(Object.keys(avail).length ? [{ $match: avail }] : []),
        { $lookup: { from: 'skills', localField: 'skills', foreignField: '_id', as: 'skills' } },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        ...(filters.university ? [{ $match: { 'user.university': filters.university } }] : []),
        ...(rx
          ? [{ $match: { $or: [
              { 'user.firstName': rx }, { 'user.lastName': rx },
              { headline: rx }, { preferred_field: rx }, { 'skills.displayName': rx },
            ] } }]
          : []),
        { $project: { 'user.password': 0, 'user.phone': 0, 'user.__v': 0, _availFrom: 0, _availTo: 0 } },
        {
          $facet: {
            data: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }],
            meta: [{ $count: 'total' }],
          },
        },
      ];

      const [res] = await Student.aggregate(pipeline);
      const students = res?.data ?? [];
      const total = res?.meta?.[0]?.total ?? 0;
      return { students, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    });
  }

  /** Distinct filter options for the directory (e.g. preferred fields). */
  async filterMeta() {
    return cached(STUDENTS_NS, ['filterMeta'], CONFIG.cache.refTtl, async () => {
      const fields = ((await Student.distinct('preferred_field')) as string[]).filter(Boolean).sort();
      return { fields };
    });
  }

  async getAllStudents(page: number, limit: number, skip: number) {
    return cached(STUDENTS_NS, ['all', page, limit], CONFIG.cache.defaultTtl, async () => {
      const [students, total] = await Promise.all([
        Student.find({})
          .populate('skills')
          .populate('education.course')
          .populate('user', '-password -phone')
          .skip(skip)
          .limit(limit)
          .lean(),
        Student.countDocuments({}),
      ]);

      return {
        students,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    });
  }
}
