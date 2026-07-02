import { Router } from 'express';
import {
  connectionStatus,
  listConnections,
  listPending,
  removeConnection,
  requestConnection,
  respondConnection,
} from '../controllers/connection.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { validate } from '../validators/auth.validator';
import { requestConnectionSchema, respondConnectionSchema } from '../validators/connection.validator';

const router = Router();

router.use(verifyJwt, requirePermission('connection:manage'));

router.get('/', listConnections);
router.get('/pending', listPending);
router.get('/status/:userId', connectionStatus);
router.post('/', validate(requestConnectionSchema), requestConnection);
router.patch('/:id/respond', validate(respondConnectionSchema), respondConnection);
router.delete('/:userId', removeConnection);

export default router;
