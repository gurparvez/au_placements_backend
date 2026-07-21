import { Router } from 'express';
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from '../controllers/department.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { optionalAuth } from '../middlewares/optionalAuth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';

const router = Router();

// Public list (optionalAuth so an admin can request inactive ones too).
router.get('/', optionalAuth, listDepartments);

// Admin-only mutations.
router.post('/', verifyJwt, requireAdmin, createDepartment);
router.put('/:id', verifyJwt, requireAdmin, updateDepartment);
router.delete('/:id', verifyJwt, requireAdmin, deleteDepartment);

export default router;
