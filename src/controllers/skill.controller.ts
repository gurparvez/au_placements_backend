import { Request, Response } from 'express';
import { SkillService } from '../services/skill.service';
import { getPagination } from '../utils/paginate';
import { asyncHandler } from '../utils/handler';

const skillService = new SkillService();

export const addSkill = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const skill = await skillService.addSkill(name);
  res.status(201).json({ success: true, data: skill });
});

export const searchSkills = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query.q as string;
  const skills = await skillService.search(q);
  res.json({ success: true, data: skills });
});

export const getAllSkills = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const result = await skillService.getAll(page, limit, skip);
  res.json({ success: true, data: result.skills, pagination: result.pagination });
});

export const getSkillById = asyncHandler(async (req: Request, res: Response) => {
  const skillId = req.params.skillId as string;
  if (!skillId) return res.status(400).json({ success: false, message: 'skillId is required' });

  const skill = await skillService.getById(skillId);
  res.json({ success: true, data: skill });
});

export const updateSkill = asyncHandler(async (req: Request, res: Response) => {
  const skill = await skillService.update(String(req.params.skillId), req.body.name ?? req.body.displayName);
  res.json({ success: true, message: 'Skill updated', data: skill });
});

export const deleteSkill = asyncHandler(async (req: Request, res: Response) => {
  const data = await skillService.remove(String(req.params.skillId));
  res.json({ success: true, message: 'Skill removed', data });
});
