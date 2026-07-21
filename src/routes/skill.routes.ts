import { Router } from 'express';
import {
  addSkill,
  deleteSkill,
  getAllSkills,
  getSkillById,
  searchSkills,
  updateSkill,
} from '../controllers/skill.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';

const router = Router();

// Public reads — the pickers on student/opening forms.
router.get('/search', searchSkills);
router.get('/', getAllSkills);
router.get('/:skillId', getSkillById);

// Admin-only mutations — the official skill list is curated, not user-generated.
router.post('/', verifyJwt, requireAdmin, addSkill);
router.put('/:skillId', verifyJwt, requireAdmin, updateSkill);
router.delete('/:skillId', verifyJwt, requireAdmin, deleteSkill);

export default router;
