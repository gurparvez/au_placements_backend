import { Router } from 'express';
import {
  applyToJob,
  createJob,
  getJob,
  getMyApplications,
  listJobs,
  recomputeJobEligibility,
} from '../controllers/job.controller';
import { optionalJwt, verifyJwt } from '../middlewares/auth.middleware';
import { validate } from '../validators/auth.validator';
import { createJobSchema } from '../validators/job.validator';

const router = Router();

router.get('/', optionalJwt, listJobs);
router.get('/applications/me', verifyJwt, getMyApplications);
router.post('/', verifyJwt, validate(createJobSchema), createJob);
router.get('/:jobId', optionalJwt, getJob);
router.post('/:jobId/apply', verifyJwt, applyToJob);
router.post('/:jobId/recompute-eligibility', verifyJwt, recomputeJobEligibility);

export default router;
