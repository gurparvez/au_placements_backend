import { Router } from 'express';
import { addCourse, getAllCourses, searchCourses } from '../controllers/course.controller';

const router = Router();

router.post('/', addCourse);
router.get('/search', searchCourses);
router.get('/', getAllCourses); // public

export default router;
