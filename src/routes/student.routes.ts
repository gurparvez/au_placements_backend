import { Router } from 'express';
import {
  createStudentProfile,
  getAllStudents,
  getAnyStudentProfile,
  getStudentProfile,
  updateStudentProfile,
} from '../controllers/student.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.post(
  '/',
  verifyJwt,
  upload.fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
  ]),
  createStudentProfile
);
router.get('/', verifyJwt, getStudentProfile);
router.put(
  '/',
  verifyJwt,
  upload.fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
  ]),
  updateStudentProfile
);
router.get('/all', getAllStudents); // public route
router.get('/profile', getAnyStudentProfile); // public route

export default router;
