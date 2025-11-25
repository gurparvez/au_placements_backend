import { Router } from 'express';
import multer from 'multer';
import {
  getUser,
  loginUser,
  logoutUser,
  registerUser,
  updatePassword,
  updateUserInfo,
} from '../controllers/auth.controller';
import { verifyJwt } from '../middlewares/auth.middleware';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post('/register', upload.single('id_card'), registerUser);
router.post('/login', loginUser);
router.get('/user', verifyJwt, getUser);
router.post('/logout', verifyJwt, logoutUser);
router.put('/update', verifyJwt, updateUserInfo);
router.put('/update-password', verifyJwt, updatePassword);

export default router;
