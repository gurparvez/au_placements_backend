import { Router } from 'express';
import { listNotifications, markRead, unreadCount } from '../controllers/notification.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { validate } from '../validators/auth.validator';
import { markReadSchema } from '../validators/message.validator';

const router = Router();

router.use(verifyJwt, requirePermission('notification:read:own'));

router.get('/', listNotifications);
router.get('/unread-count', unreadCount);
router.post('/read', validate(markReadSchema), markRead);

export default router;
