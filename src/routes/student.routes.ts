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
import { validate } from '../validators/auth.validator';
import { updateProfileSchema } from '../validators/student.validator';

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
  validate(updateProfileSchema),
  updateStudentProfile
);
router.get('/all', getAllStudents);             // Public: recruiters can browse
router.get('/profile', getAnyStudentProfile);   // Public: recruiters can view profiles

export default router;
