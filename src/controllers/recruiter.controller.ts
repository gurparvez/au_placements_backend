import { Request, Response } from 'express';
import { RecruiterService } from '../services/recruiter.service';
import { asyncHandler } from '../utils/handler';
import { getPagination } from '../utils/paginate';

const recruiterService = new RecruiterService();

// Public: a recruiter requests an account (created pending, awaiting admin approval).
export const requestRecruiter = asyncHandler(async (req: Request, res: Response) => {
  const result = await recruiterService.request(req.body);
  res.status(201).json({
    success: true,
    message: 'Request submitted. An admin will review your account shortly.',
    data: result,
  });
});

// Recruiter: get own company profile.
export const getMyRecruiterProfile = asyncHandler(async (_req: Request, res: Response) => {
  const result = await recruiterService.getOwn(String(res.locals.user._id));
  res.json({ success: true, data: result });
});

// Recruiter: update own company profile (optional logo upload).
export const updateMyRecruiterProfile = asyncHandler(async (req: Request, res: Response) => {
  const logo = (req.file as Express.Multer.File | undefined)?.buffer;
  const result = await recruiterService.updateOwn(String(res.locals.user._id), req.body, logo);
  res.json({ success: true, message: 'Company profile updated', data: result });
});

// Admin: create an already-approved recruiter.
export const createRecruiter = asyncHandler(async (req: Request, res: Response) => {
  const result = await recruiterService.createByAdmin(req.body);
  res.status(201).json({ success: true, message: 'Recruiter created', data: result });
});

// Admin: list recruiters (optional ?status=&q=).
export const listRecruiters = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const result = await recruiterService.list(page, limit, skip, status, q);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

// Admin: approve a recruiter.
export const approveRecruiter = asyncHandler(async (req: Request, res: Response) => {
  const result = await recruiterService.approve(String(req.params.id), String(res.locals.user._id));
  res.json({ success: true, message: 'Recruiter approved', data: result });
});

// Admin: reject a recruiter.
export const rejectRecruiter = asyncHandler(async (req: Request, res: Response) => {
  const result = await recruiterService.reject(String(req.params.id), String(res.locals.user._id), req.body?.reason);
  res.json({ success: true, message: 'Recruiter rejected', data: result });
});
