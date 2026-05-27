import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { CONFIG } from '../config/environment';
import {
  forgotPassword,
  getUser,
  loginUser,
  logoutUser,
  registerUser,
  resendVerification,
  resetPassword,
  updatePassword,
  updateUserInfo,
  verifyEmail,
} from '../controllers/auth.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  validate,
  verifyEmailSchema,
} from '../validators/auth.validator';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed for ID card.'));
    }
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: CONFIG.env === 'production' ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

const router = Router();

router.post('/register', authLimiter, upload.single('id_card'), validate(registerSchema), registerUser);
router.post('/login', authLimiter, validate(loginSchema), loginUser);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), verifyEmail);
router.post(
  '/resend-verification',
  authLimiter,
  validate(resendVerificationSchema),
  resendVerification
);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.get('/user', verifyJwt, getUser);
router.post('/logout', verifyJwt, logoutUser);
router.put('/update', verifyJwt, updateUserInfo);
router.put('/update-password', verifyJwt, updatePassword);

export default router;
