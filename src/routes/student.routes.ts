import { Router } from 'express';
import {
  browseStudents,
  createStudentProfile,
  getAllStudents,
  getAnyStudentProfile,
  getStudentProfile,
  searchStudents,
  studentFilterMeta,
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
router.get('/all', getAllStudents);             // Public: anyone can explore students
router.get('/browse', browseStudents);          // Public: filtered + paginated directory
router.get('/filters', studentFilterMeta);      // Public: distinct filter options
router.get('/search', searchStudents);          // Public: search students by name or AUID
router.get('/profile', getAnyStudentProfile);   // Public: recruiters can view profiles

export default router;
