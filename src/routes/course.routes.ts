import { Router } from 'express';
import {
  addCourse,
  getAllCourses,
  getCourseById,
  searchCourses,
} from '../controllers/course.controller';
import { verifyJwt } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', verifyJwt, addCourse);
router.get('/search', searchCourses);
router.get('/', getAllCourses);
router.get('/:id', getCourseById);

export default router;
