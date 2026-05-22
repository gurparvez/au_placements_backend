import { Skill } from '../models/skill.model';
import { escapeRegex } from '../utils/escapeRegex';
import { ApiError } from '../utils/ApiError';

export class SkillService {
  async addSkill(name: string) {
    const normalized = name.trim().toLowerCase();
    return Skill.findOneAndUpdate(
      { name: normalized },
      { name: normalized, displayName: name.trim() },
      { upsert: true, new: true }
    );
  }

  async search(query: string) {
    const safeQ = escapeRegex(query);
    return Skill.find({ name: { $regex: safeQ, $options: 'i' } }).limit(10);
  }

  async getAll(page: number, limit: number, skip: number) {
    const [skills, total] = await Promise.all([
      Skill.find({}).skip(skip).limit(limit),
      Skill.countDocuments({}),
    ]);
    return { skills, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(skillId: string) {
    const skill = await Skill.findById(skillId);
    if (!skill) throw new ApiError(404, 'Skill not found');
    return skill;
  }
}
