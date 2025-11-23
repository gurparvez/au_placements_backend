import { Router } from 'express';
import { addSkill, getAllSkills, getSkillById, searchSkills } from '../controllers/skill.controller';

const router = Router();

router.post('/', addSkill);
router.get('/search', searchSkills);
router.get("/", getAllSkills);
router.get("/:skillId", getSkillById);

export default router;
