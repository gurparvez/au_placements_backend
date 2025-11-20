import { Router } from 'express';
import {
  createStudentProfile,
  getStudentProfile,
  updateStudentProfile,
} from '../controllers/student.controller';
import { verifyJwt } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', verifyJwt, createStudentProfile);
router.get('/', verifyJwt, getStudentProfile);
router.put('/', verifyJwt, updateStudentProfile);

export default router;
