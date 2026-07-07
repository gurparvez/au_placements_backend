import { Router } from 'express';
import multer from 'multer';
import {
  archivePost,
  createComment,
  createPost,
  deletePost,
  getPost,
  listByUser,
  listComments,
  listFeed,
  reactToPost,
  sharePost,
  updatePost,
} from '../controllers/post.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { optionalAuth } from '../middlewares/optionalAuth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { validate } from '../validators/auth.validator';
import {
  archivePostSchema,
  createCommentSchema,
  reactSchema,
  sharePostSchema,
  updatePostSchema,
} from '../validators/post.validator';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB each
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

// Feed + single post: public, personalized if logged in.
router.get('/', optionalAuth, listFeed);
router.get('/user/:userId', optionalAuth, listByUser); // posts by a specific author (declared before '/:id')
router.get('/:id', optionalAuth, getPost);

// Authoring — accepts up to 4 images (multipart) or a JSON body.
router.post('/', verifyJwt, requirePermission('post:create'), upload.array('images', 4), createPost);
router.put('/:id', verifyJwt, requirePermission('post:create'), validate(updatePostSchema), updatePost);
router.delete('/:id', verifyJwt, requirePermission('post:create'), deletePost);
router.patch('/:id/archive', verifyJwt, requirePermission('post:create'), validate(archivePostSchema), archivePost);
router.post('/:id/share', verifyJwt, requirePermission('post:share'), validate(sharePostSchema), sharePost);
router.post('/:id/react', verifyJwt, requirePermission('post:react'), validate(reactSchema), reactToPost);

// Comments on a post
router.get('/:id/comments', optionalAuth, listComments);
router.post('/:id/comments', verifyJwt, requirePermission('post:comment'), validate(createCommentSchema), createComment);

export default router;
