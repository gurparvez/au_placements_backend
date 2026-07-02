import { Router } from 'express';
import { homeController } from '../controllers/home.controller';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import commentRoutes from './comment.routes';
import companyRoutes from './company.routes';
import connectionRoutes from './connection.routes';
import conversationRoutes from './conversation.routes';
import courseRoutes from './course.routes';
import notificationRoutes from './notification.routes';
import openingRoutes from './opening.routes';
import outreachRoutes from './outreach.routes';
import postRoutes from './post.routes';
import skillRoutes from './skill.routes';
import studentRoutes from './student.routes';
import userRoutes from './user.routes';

const router = Router();

// Main home route
router.get('/', homeController);

// Mount additional route groups
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/student', studentRoutes);
router.use('/skills', skillRoutes);
router.use('/courses', courseRoutes);
router.use('/outreach', outreachRoutes);
router.use('/openings', openingRoutes);
router.use('/posts', postRoutes);
router.use('/comments', commentRoutes);
router.use('/users', userRoutes);
router.use('/conversations', conversationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/connections', connectionRoutes);
router.use('/companies', companyRoutes);

export default router;
