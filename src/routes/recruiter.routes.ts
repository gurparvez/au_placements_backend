import { Router } from 'express';
import {
  getMyRecruiterProfile,
  updateMyRecruiterProfile,
} from '../controllers/recruiter.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/permission.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

// A recruiter manages their own company profile.
router.get('/me', verifyJwt, requireRole('recruiter'), getMyRecruiterProfile);
router.put('/me', verifyJwt, requireRole('recruiter'), upload.single('company_logo'), updateMyRecruiterProfile);

export default router;
