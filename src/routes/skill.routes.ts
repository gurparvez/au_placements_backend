import { Router } from 'express';
import { addSkill, getAllSkills, searchSkills } from '../controllers/skill.controller';

const router = Router();

router.post('/', addSkill);
router.get('/search', searchSkills);
router.get("/", getAllSkills);

export default router;
