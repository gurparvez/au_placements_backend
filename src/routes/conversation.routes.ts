import { Router } from 'express';
import {
  listConversations,
  listMessages,
  sendMessage,
  startConversation,
} from '../controllers/message.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { validate } from '../validators/auth.validator';
import { sendMessageSchema, startConversationSchema } from '../validators/message.validator';

const router = Router();

router.use(verifyJwt, requirePermission('message:send'));

router.get('/', listConversations);
router.post('/', validate(startConversationSchema), startConversation);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', validate(sendMessageSchema), sendMessage);

export default router;
