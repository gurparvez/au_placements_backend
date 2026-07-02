import { Router } from 'express';
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '../controllers/user.controller';
import {
  approveRecruiter,
  createRecruiter,
  listRecruiters,
  rejectRecruiter,
} from '../controllers/recruiter.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';
import { validate } from '../validators/auth.validator';
import { createUserSchema, updateUserSchema } from '../validators/user.validator';
import { adminCreateRecruiterSchema, rejectRecruiterSchema } from '../validators/recruiter.validator';

const router = Router();

// All admin routes require an authenticated admin.
router.use(verifyJwt, requireAdmin);

router.get('/users', listUsers);
router.post('/users', validate(createUserSchema), createUser);
router.get('/users/:id', getUser);
router.put('/users/:id', validate(updateUserSchema), updateUser);
router.delete('/users/:id', deleteUser);

// Recruiter management
router.get('/recruiters', listRecruiters);
router.post('/recruiters', validate(adminCreateRecruiterSchema), createRecruiter);
router.patch('/recruiters/:id/approve', approveRecruiter);
router.patch('/recruiters/:id/reject', validate(rejectRecruiterSchema), rejectRecruiter);

export default router;
