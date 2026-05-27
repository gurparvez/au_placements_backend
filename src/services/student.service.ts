import {
  Student,
  calculateCurrentCgpa,
  calculateProfileCompletion,
  calculateTotalExperience,
} from '../models/student.model';
import { StudentProfileHistory } from '../models/studentProfileHistory.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { saveMediaFile } from '../utils/mediaStorage';
import { JobService } from './job.service';

const jobService = new JobService();

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
      const file = files['profile_image'][0];
      const uploaded = await saveMediaFile(
        file.buffer,
        'students/profile-images',
        file.mimetype,
        file.originalname
      );
      data.profile_image = uploaded.publicUrl;
    }
    if (files?.['resume']?.[0]) {
      const file = files['resume'][0];
      const uploaded = await saveMediaFile(
        file.buffer,
        'students/resumes',
        file.mimetype,
        file.originalname
      );
      data.resume_link = uploaded.publicUrl;
    }
    if (files?.['supporting_documents']?.length) {
      data.supporting_documents = await Promise.all(
        files['supporting_documents'].map(async (file) => {
          const uploaded = await saveMediaFile(
            file.buffer,
            'students/supporting-documents',
            file.mimetype,
            file.originalname
          );

          return {
            name: file.originalname,
            url: uploaded.publicUrl,
            mime_type: file.mimetype,
            uploaded_at: new Date(),
          };
        })
      );
    }
    return data;
  }

  async createProfile(userId: string, body: Record<string, any>, files?: { [fieldname: string]: Express.Multer.File[] }) {
    const existing = await Student.findOne({ user: userId });
    if (existing) throw new ApiError(400, 'Profile already exists');

    let studentData = { ...body };
    studentData = await this.handleFileUploads(files, studentData);
    studentData = this.parseJsonFields(studentData, [
      'education',
      'academic_records',
      'experience',
      'projects',
      'certificates',
      'skills',
      'looking_for',
      'links',
      'achievements',
      'extracurricular_activities',
    ]);
    studentData.total_experience = calculateTotalExperience(studentData.experience);
    studentData.cgpa_current = calculateCurrentCgpa(studentData.academic_records);
    studentData.profile_completion = calculateProfileCompletion(studentData);

    const profile = await Student.create({ user: userId, ...studentData });
    await jobService.recomputeEligibilityForStudent(userId);
    return profile;
  }

  async getProfile(userId: string) {
    return Student.findOne({ user: userId }).populate('skills').populate('education.course');
  }

  async getProfileByUserId(userId: string) {
    const profile = await Student.findOne({ user: userId }).populate('skills').populate('education.course');
    if (!profile) throw new ApiError(404, 'Profile not found');

    const user = await User.findById(userId).select('-password -__v');
    return { user, profile };
  }

  async updateProfile(userId: string, body: Record<string, any>, files?: { [fieldname: string]: Express.Multer.File[] }) {
    const existing = await Student.findOne({ user: userId }).lean();
    if (!existing) throw new ApiError(404, 'Student profile not found');

    let updateData: any = { ...body };
    updateData = await this.handleFileUploads(files, updateData);
    updateData = this.parseJsonFields(updateData, [
      'education',
      'academic_records',
      'experience',
      'projects',
      'certificates',
      'skills',
      'looking_for',
      'links',
      'achievements',
      'extracurricular_activities',
    ]);

    const mergedData = {
      ...existing,
      ...updateData,
      supporting_documents: updateData.supporting_documents
        ? [...(existing.supporting_documents || []), ...updateData.supporting_documents]
        : existing.supporting_documents,
    };

    if (updateData.supporting_documents) {
      updateData.supporting_documents = mergedData.supporting_documents;
    }

    updateData.total_experience = calculateTotalExperience(mergedData.experience);
    updateData.cgpa_current = calculateCurrentCgpa(mergedData.academic_records);
    updateData.profile_completion = calculateProfileCompletion(mergedData as any);
    updateData.profile_version = (existing.profile_version || 1) + 1;

    await StudentProfileHistory.create({
      student: existing._id,
      user: existing.user,
      profile_version: existing.profile_version || 1,
      snapshot: existing,
    });

    const updated = await Student.findOneAndUpdate(
      { user: userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    await jobService.recomputeEligibilityForStudent(userId);
    return updated;
  }

  async markProfileReviewed(userId: string) {
    const existing = await Student.findOne({ user: userId }).lean();
    if (!existing) throw new ApiError(404, 'Student profile not found');

    await StudentProfileHistory.create({
      student: existing._id,
      user: existing.user,
      profile_version: existing.profile_version || 1,
      snapshot: existing,
    });

    const updated = await Student.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          last_profile_reviewed_at: new Date(),
          profile_version: (existing.profile_version || 1) + 1,
        },
      },
      { new: true, runValidators: true }
    )
      .populate('skills')
      .populate('education.course');

    return updated;
  }

  async getProfileHistory(userId: string) {
    return StudentProfileHistory.find({ user: userId })
      .sort({ profile_version: -1, created_at: -1 })
      .limit(50);
  }

  async getAllStudents(page: number, limit: number, skip: number) {
    const [students, total] = await Promise.all([
      Student.find({})
        .populate('skills')
        .populate('education.course')
        .populate('user', '-password')
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
