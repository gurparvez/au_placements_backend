import { Request, Response } from 'express';
import { Skill } from '../models/skill.model';

export const addSkill = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const normalized = name.trim().toLowerCase();

    const skill = await Skill.findOneAndUpdate(
      { name: normalized },
      { name: normalized, displayName: name.trim() },
      { upsert: true, new: true }
    );

    res.status(201).json(skill);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add skill' });
  }
};

export const searchSkills = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;

    const skills = await Skill.find({
      name: { $regex: q, $options: 'i' },
    }).limit(10);

    res.json(skills);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
};

export const getAllSkills = async (req: Request, res: Response) => {
  try {
    const skills = await Skill.find({});
    res.json({ success: true, skills });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch skills" });
  }
};

export const getSkillById = async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;

    if (!skillId) {
      return res.status(400).json({ error: "skillId is required" });
    }

    const skill = await Skill.findById(skillId);

    if (!skill) {
      return res.status(404).json({ error: "Skill not found" });
    }

    res.json({ success: true, skill });
  } catch (err) {
    console.log("getSkillById ERROR:", err);
    res.status(500).json({ error: "Failed to fetch skill" });
  }
};
