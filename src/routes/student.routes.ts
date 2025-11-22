import { Router } from 'express';
import {
  createStudentProfile,
  getStudentProfile,
  updateStudentProfile,
} from '../controllers/student.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { upload } from "../middlewares/upload.middleware";

const router = Router();

router.post('/', verifyJwt, upload.single("profile_image"), createStudentProfile);
router.get('/', verifyJwt, getStudentProfile);
router.put('/', verifyJwt, upload.single("profile_image"), updateStudentProfile);

export default router;
