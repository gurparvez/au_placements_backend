import { Router } from 'express';
import {
  addCourse,
  deleteCourse,
  getAllCourses,
  getCourseById,
  searchCourses,
  updateCourse,
} from '../controllers/course.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';

const router = Router();

// Public reads — the course picker on the student form.
router.get('/search', searchCourses);
router.get('/', getAllCourses);
router.get('/:id', getCourseById);

// Admin-only mutations — courses are institutional reference data.
router.post('/', verifyJwt, requireAdmin, addCourse);
router.put('/:id', verifyJwt, requireAdmin, updateCourse);
router.delete('/:id', verifyJwt, requireAdmin, deleteCourse);

export default router;
