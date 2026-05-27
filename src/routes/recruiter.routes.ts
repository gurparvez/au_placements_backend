import { Router } from 'express';
import {
  createRecruiterRequest,
  listRecruiterRequests,
  reviewRecruiterRequest,
} from '../controllers/recruiter.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { validate } from '../validators/auth.validator';
import {
  createRecruiterRequestSchema,
  reviewRecruiterRequestSchema,
} from '../validators/recruiter.validator';

const router = Router();

router.post('/requests', validate(createRecruiterRequestSchema), createRecruiterRequest);
router.get('/requests', verifyJwt, listRecruiterRequests);
router.patch(
  '/requests/:requestId',
  verifyJwt,
  validate(reviewRecruiterRequestSchema),
  reviewRecruiterRequest
);

export default router;
