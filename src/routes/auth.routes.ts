import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CONFIG } from '../config/environment';
import {
  getUser,
  loginUser,
  logoutUser,
  updatePassword,
  updateUserInfo,
} from '../controllers/auth.controller';
import { requestRecruiter } from '../controllers/recruiter.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { validate, loginSchema } from '../validators/auth.validator';
import { recruiterRequestSchema } from '../validators/recruiter.validator';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: CONFIG.env === 'production' ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), loginUser);
// Public: recruiters request an account (created pending, admin approves).
router.post('/recruiter-request', authLimiter, validate(recruiterRequestSchema), requestRecruiter);
router.get('/user', verifyJwt, getUser);
router.post('/logout', verifyJwt, logoutUser);
router.put('/update', verifyJwt, updateUserInfo);
router.put('/update-password', verifyJwt, updatePassword);

export default router;
