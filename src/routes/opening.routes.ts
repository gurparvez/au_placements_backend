import { Router } from 'express';
import {
  createOpening,
  deleteOpening,
  getOpening,
  listMyOpenings,
  listOpenings,
  setOpeningStatus,
  updateOpening,
} from '../controllers/opening.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { validate } from '../validators/auth.validator';
import { createOpeningSchema, openingStatusSchema, updateOpeningSchema } from '../validators/opening.validator';

const router = Router();

// Public browse
router.get('/', listOpenings);

// Recruiter's own — must be declared before '/:id'
router.get('/mine', verifyJwt, requirePermission('opening:create'), listMyOpenings);

// Public single
router.get('/:id', getOpening);

// Recruiter/owner mutations
router.post('/', verifyJwt, requirePermission('opening:create'), validate(createOpeningSchema), createOpening);
router.put('/:id', verifyJwt, requirePermission('opening:update:own'), validate(updateOpeningSchema), updateOpening);
router.patch('/:id/status', verifyJwt, requirePermission('opening:update:own'), validate(openingStatusSchema), setOpeningStatus);
router.delete('/:id', verifyJwt, requirePermission('opening:update:own'), deleteOpening);

export default router;
