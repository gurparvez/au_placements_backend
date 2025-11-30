import { Router } from 'express';
import {
  addCourse,
  getAllCourses,
  getCourseById,
  searchCourses,
} from '../controllers/course.controller';

const router = Router();

router.post('/', addCourse);
router.get('/search', searchCourses);
router.get('/', getAllCourses);
router.get('/:id', getCourseById);

export default router;
