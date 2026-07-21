import { Department } from '../models/department.model';
import { Student } from '../models/student.model';
import { ApiError } from '../utils/ApiError';
import { cached, bumpVersion } from '../utils/cache';
import { CONFIG } from '../config/environment';

const NS = 'departments';

export class DepartmentService {
  /** Active departments only — the list students and forms pick from. */
  async list(includeInactive = false) {
    return cached(NS, ['list', includeInactive], CONFIG.cache.refTtl, () =>
      Department.find(includeInactive ? {} : { active: true }).sort({ name: 1 }).lean()
    );
  }

  async create(name: string, code?: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new ApiError(400, 'Department name is required.');
    const exists = await Department.findOne({ name: trimmed });
    if (exists) throw new ApiError(409, 'A department with that name already exists.');
    const doc = await Department.create({ name: trimmed, code: code?.trim() });
    await bumpVersion(NS);
    return doc;
  }

  async update(id: string, data: { name?: string; code?: string; active?: boolean }) {
    const doc = await Department.findById(id);
    if (!doc) throw new ApiError(404, 'Department not found.');

    // Renaming must cascade to students, or their records point at a name that
    // no longer exists in the list and silently drop out of grouped reports.
    if (data.name && data.name.trim() && data.name.trim() !== doc.name) {
      const newName = data.name.trim();
      const clash = await Department.findOne({ name: newName, _id: { $ne: id } });
      if (clash) throw new ApiError(409, 'Another department already uses that name.');
      await Student.updateMany({ department: doc.name }, { $set: { department: newName } });
      doc.name = newName;
    }
    if (data.code !== undefined) doc.code = data.code.trim();
    if (data.active !== undefined) doc.active = data.active;

    await doc.save();
    await Promise.all([bumpVersion(NS), bumpVersion('students'), bumpVersion('analytics')]);
    return doc;
  }

  async remove(id: string) {
    const doc = await Department.findById(id);
    if (!doc) throw new ApiError(404, 'Department not found.');

    // Never orphan students: block deletion while any student is in it. The
    // admin can deactivate instead to hide it from new selections.
    const inUse = await Student.countDocuments({ department: doc.name });
    if (inUse > 0) {
      throw new ApiError(
        409,
        `${inUse} student(s) are in "${doc.name}". Deactivate it instead of deleting.`
      );
    }
    await doc.deleteOne();
    await bumpVersion(NS);
    return { _id: id };
  }
}

export const departmentService = new DepartmentService();
