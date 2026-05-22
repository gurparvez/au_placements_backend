import { Course } from '../models/course.model';
import { escapeRegex } from '../utils/escapeRegex';
import { ApiError } from '../utils/ApiError';

export class CourseService {
  async addCourse(name: string, category?: string) {
    return Course.findOneAndUpdate(
      { name },
      { name, category },
      { upsert: true, new: true }
    );
  }

  async search(query: string) {
    const safeQ = escapeRegex(query);
    return Course.find({ name: { $regex: safeQ, $options: 'i' } }).limit(10);
  }

  async getAll(page: number, limit: number, skip: number) {
    const [courses, total] = await Promise.all([
      Course.find({}).skip(skip).limit(limit),
      Course.countDocuments({}),
    ]);
    return { courses, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    const course = await Course.findById(id);
    if (!course) throw new ApiError(404, 'Course not found');
    return course;
  }
}
