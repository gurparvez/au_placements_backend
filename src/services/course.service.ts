import { Course } from '../models/course.model';
import { escapeRegex } from '../utils/escapeRegex';
import { ApiError } from '../utils/ApiError';
import { cached, bumpVersion } from '../utils/cache';
import { CONFIG } from '../config/environment';

export class CourseService {
  async addCourse(name: string, category?: string) {
    const course = await Course.findOneAndUpdate(
      { name },
      { name, category },
      { upsert: true, new: true }
    );
    await bumpVersion('courses');
    return course;
  }

  async search(query: string) {
    const safeQ = escapeRegex(query);
    return cached('courses', ['search', query.trim().toLowerCase()], CONFIG.cache.refTtl, () =>
      Course.find({ name: { $regex: safeQ, $options: 'i' } }).limit(10).lean()
    );
  }

  async getAll(page: number, limit: number, skip: number) {
    return cached('courses', ['all', page, limit], CONFIG.cache.refTtl, async () => {
      const [courses, total] = await Promise.all([
        Course.find({}).skip(skip).limit(limit).lean(),
        Course.countDocuments({}),
      ]);
      return { courses, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    });
  }

  async getById(id: string) {
    const course = await Course.findById(id);
    if (!course) throw new ApiError(404, 'Course not found');
    return course;
  }

  async update(id: string, data: { name?: string; category?: string }) {
    const patch: Record<string, any> = {};
    if (data.name && data.name.trim()) patch.name = data.name.trim();
    if (data.category) patch.category = data.category;
    const course = await Course.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
    if (!course) throw new ApiError(404, 'Course not found');
    await bumpVersion('courses');
    return course;
  }

  async remove(id: string) {
    const course = await Course.findByIdAndDelete(id);
    if (!course) throw new ApiError(404, 'Course not found');
    await bumpVersion('courses');
    return { _id: id };
  }
}
