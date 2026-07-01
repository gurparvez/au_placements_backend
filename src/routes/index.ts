import { Router } from 'express';
import { homeController } from '../controllers/home.controller';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import courseRoutes from './course.routes';
import skillRoutes from './skill.routes';
import studentRoutes from './student.routes';

const router = Router();

// Main home route
router.get('/', homeController);

// Mount additional route groups
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/student', studentRoutes);
router.use('/skills', skillRoutes);
router.use('/courses', courseRoutes);

export default router;
