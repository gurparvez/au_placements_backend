import { Skill } from '../models/skill.model';
import { escapeRegex } from '../utils/escapeRegex';
import { ApiError } from '../utils/ApiError';
import { cached, bumpVersion } from '../utils/cache';
import { CONFIG } from '../config/environment';

export class SkillService {
  async addSkill(name: string) {
    const normalized = name.trim().toLowerCase();
    const skill = await Skill.findOneAndUpdate(
      { name: normalized },
      { name: normalized, displayName: name.trim() },
      { upsert: true, new: true }
    );
    await bumpVersion('skills'); // invalidate cached skill lists/searches
    return skill;
  }

  async search(query: string) {
    const safeQ = escapeRegex(query);
    return cached('skills', ['search', query.trim().toLowerCase()], CONFIG.cache.refTtl, () =>
      Skill.find({ name: { $regex: safeQ, $options: 'i' } }).limit(10).lean()
    );
  }

  async getAll(page: number, limit: number, skip: number) {
    return cached('skills', ['all', page, limit], CONFIG.cache.refTtl, async () => {
      const [skills, total] = await Promise.all([
        Skill.find({}).skip(skip).limit(limit).lean(),
        Skill.countDocuments({}),
      ]);
      return { skills, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    });
  }

  async getById(skillId: string) {
    const skill = await Skill.findById(skillId);
    if (!skill) throw new ApiError(404, 'Skill not found');
    return skill;
  }
}
