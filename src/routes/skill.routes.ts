import { Router } from 'express';
import { addSkill, getAllSkills, getSkillById, searchSkills } from '../controllers/skill.controller';
import { verifyJwt } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', verifyJwt, addSkill);
router.get('/search', searchSkills);
router.get("/", getAllSkills);
router.get("/:skillId", getSkillById);

export default router;
