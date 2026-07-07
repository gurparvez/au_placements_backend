import { Student } from '../models/student.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { uploadToCloudinary } from '../utils/uploadToCloudinary';

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

  async getAllStudents(page: number, limit: number, skip: number) {
    const [students, total] = await Promise.all([
      Student.find({})
        .populate('skills')
        .populate('education.course')
        .populate('user', '-password -phone')
        .skip(skip)
        .limit(limit),
      Student.countDocuments({}),
    ]);

    return {
      students,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
