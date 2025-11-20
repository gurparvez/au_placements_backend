import { Router } from 'express';
import multer from 'multer';
import { loginUser, registerUser } from '../controllers/auth.controller';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post('/register', upload.single('id_card'), registerUser);
router.post('/login', loginUser);

export default router;
