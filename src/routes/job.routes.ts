import { Router } from 'express';
import {
  applyToJob,
  createJob,
  getJob,
  getJobApplicants,
  getMyApplications,
  listJobs,
  overrideJobEligibility,
  recomputeJobEligibility,
  updateApplicationStatus,
  updateJob,
} from '../controllers/job.controller';
import { optionalJwt, verifyJwt } from '../middlewares/auth.middleware';
import { validate } from '../validators/auth.validator';
import {
  createJobSchema,
  eligibilityOverrideSchema,
  updateApplicationStatusSchema,
  updateJobSchema,
} from '../validators/job.validator';

const router = Router();

router.get('/', optionalJwt, listJobs);
router.get('/applications/me', verifyJwt, getMyApplications);
router.post('/', verifyJwt, validate(createJobSchema), createJob);
router.get('/:jobId', optionalJwt, getJob);
router.patch('/:jobId', verifyJwt, validate(updateJobSchema), updateJob);
router.get('/:jobId/applications', verifyJwt, getJobApplicants);
router.post('/:jobId/apply', verifyJwt, applyToJob);
router.post('/:jobId/recompute-eligibility', verifyJwt, recomputeJobEligibility);
router.post('/:jobId/eligibility-overrides', verifyJwt, validate(eligibilityOverrideSchema), overrideJobEligibility);
router.patch(
  '/:jobId/applications/:applicationId',
  verifyJwt,
  validate(updateApplicationStatusSchema),
  updateApplicationStatus
);

export default router;
