import { Router } from 'express';
import { emailStudent } from '../controllers/outreach.controller';
import { verifyJwt } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permission.middleware';
import { validate } from '../validators/auth.validator';
import { sendOutreachSchema } from '../validators/outreach.validator';

const router = Router();

// Inbuilt emailing: only a logged-in, active recruiter may email a student.
router.post('/', verifyJwt, requirePermission('outreach:send'), validate(sendOutreachSchema), emailStudent);

export default router;
