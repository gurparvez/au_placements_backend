import { Router } from 'express';
import {
  followCompany,
  listCompanies,
  listFollowing,
  unfollowCompany,
} from '../controllers/company.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { optionalAuth } from '../middlewares/optionalAuth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';

const router = Router();

// Public directory (personalized if logged in).
router.get('/', optionalAuth, listCompanies);

// Following actions
router.get('/following', verifyJwt, requirePermission('follow:manage'), listFollowing);
router.post('/:id/follow', verifyJwt, requirePermission('follow:manage'), followCompany);
router.delete('/:id/follow', verifyJwt, requirePermission('follow:manage'), unfollowCompany);

export default router;
