import { Router } from 'express';
import {
  applyToOpening,
  createOpening,
  deleteOpening,
  getOpening,
  listApplicants,
  listMyOpenings,
  listOpenings,
  setOpeningStatus,
  updateOpening,
} from '../controllers/opening.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { optionalAuth } from '../middlewares/optionalAuth.middleware';
import { requirePermission, requireRole } from '../middlewares/permission.middleware';
import { validate } from '../validators/auth.validator';
import { createOpeningSchema, openingStatusSchema, updateOpeningSchema } from '../validators/opening.validator';

const router = Router();

// Public browse (personalized has_applied when logged in)
router.get('/', optionalAuth, listOpenings);

// Recruiter's own — must be declared before '/:id'
router.get('/mine', verifyJwt, requirePermission('opening:create'), listMyOpenings);

// Public single
router.get('/:id', optionalAuth, getOpening);

// Recruiter/owner: applicants list
router.get('/:id/applicants', verifyJwt, requirePermission('opening:update:own'), listApplicants);

// Student: apply
router.post('/:id/apply', verifyJwt, requireRole('student'), applyToOpening);

// Recruiter/owner mutations
router.post('/', verifyJwt, requirePermission('opening:create'), validate(createOpeningSchema), createOpening);
router.put('/:id', verifyJwt, requirePermission('opening:update:own'), validate(updateOpeningSchema), updateOpening);
router.patch('/:id/status', verifyJwt, requirePermission('opening:update:own'), validate(openingStatusSchema), setOpeningStatus);
router.delete('/:id', verifyJwt, requirePermission('opening:update:own'), deleteOpening);

export default router;
