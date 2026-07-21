import { Router } from 'express';
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '../controllers/user.controller';
import {
  approveRecruiter,
  createRecruiter,
  listRecruiters,
  rejectRecruiter,
} from '../controllers/recruiter.controller';
import {
  createPlacement,
  deletePlacement,
  createInvitation,
  deleteInvitation,
  getDashboard,
  getFilterOptions,
  getPolicySettings,
  listInvitations,
  updateInvitation,
  updatePolicySettings,
  updateStudentRecord,
  getUnplacedFinalYear,
  listPlacements,
  placementFromApplication,
  updatePlacement,
} from '../controllers/analytics.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';
import { validate } from '../validators/auth.validator';
import { createUserSchema, updateUserSchema } from '../validators/user.validator';
import { adminCreateRecruiterSchema, rejectRecruiterSchema } from '../validators/recruiter.validator';

const router = Router();

// All admin routes require an authenticated admin.
router.use(verifyJwt, requireAdmin);

router.get('/users', listUsers);
router.post('/users', validate(createUserSchema), createUser);
router.get('/users/:id', getUser);
router.put('/users/:id', validate(updateUserSchema), updateUser);
router.delete('/users/:id', deleteUser);

// Placement analytics dashboard
router.get('/analytics/dashboard', getDashboard);
router.get('/analytics/filters', getFilterOptions);
router.get('/analytics/unplaced', getUnplacedFinalYear);

// Placement records
router.get('/placements', listPlacements);
router.post('/placements', createPlacement);
router.put('/placements/:id', updatePlacement);
router.delete('/placements/:id', deletePlacement);
router.post('/placements/from-application/:applicationId', placementFromApplication);

// Placement policy (the offer-lock / tiering rules)
router.get('/policy', getPolicySettings);
router.put('/policy', updatePolicySettings);

// Company outreach tracking
router.get('/invitations', listInvitations);
router.post('/invitations', createInvitation);
router.put('/invitations/:id', updateInvitation);
router.delete('/invitations/:id', deleteInvitation);

// TPO-owned student academic + readiness record
router.put('/students/:userId/record', updateStudentRecord);

// Recruiter management
router.get('/recruiters', listRecruiters);
router.post('/recruiters', validate(adminCreateRecruiterSchema), createRecruiter);
router.patch('/recruiters/:id/approve', approveRecruiter);
router.patch('/recruiters/:id/reject', validate(rejectRecruiterSchema), rejectRecruiter);

export default router;
