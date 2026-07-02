import { Router } from 'express';
import { deleteComment, reactToComment } from '../controllers/comment.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { validate } from '../validators/auth.validator';
import { reactSchema } from '../validators/post.validator';

const router = Router();

router.delete('/:id', verifyJwt, requirePermission('post:comment'), deleteComment);
router.post('/:id/react', verifyJwt, requirePermission('post:react'), validate(reactSchema), reactToComment);

export default router;
