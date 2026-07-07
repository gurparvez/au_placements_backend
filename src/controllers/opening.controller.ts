import { Request, Response } from 'express';
import { OpeningService } from '../services/opening.service';
import { asyncHandler } from '../utils/handler';
import { getPagination } from '../utils/paginate';

const openingService = new OpeningService();
const viewerId = (res: Response) => (res.locals.user ? String(res.locals.user._id) : undefined);

// Public: browse open positions with filters.
export const listOpenings = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const filters = {
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    type: typeof req.query.type === 'string' ? req.query.type : undefined,
    university: typeof req.query.university === 'string' ? req.query.university : undefined,
    skill: typeof req.query.skill === 'string' ? req.query.skill : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    recruiter: typeof req.query.recruiter === 'string' ? req.query.recruiter : undefined,
  };
  const result = await openingService.list(filters, page, limit, skip, viewerId(res));
  res.json({ success: true, data: result.openings, pagination: result.pagination });
});

// Recruiter: their own openings (any status). Declared before /:id in the router.
export const listMyOpenings = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const result = await openingService.listMine(String(res.locals.user._id), page, limit, skip);
  res.json({ success: true, data: result.openings, pagination: result.pagination });
});

// Public: single opening.
export const getOpening = asyncHandler(async (req: Request, res: Response) => {
  const opening = await openingService.getById(String(req.params.id), viewerId(res));
  res.json({ success: true, data: opening });
});

// Student: apply to an opening.
export const applyToOpening = asyncHandler(async (req: Request, res: Response) => {
  const result = await openingService.apply(String(req.params.id), String(res.locals.user._id));
  res.status(201).json({ success: true, message: 'Application submitted', data: result });
});

// Recruiter/owner: see who applied.
export const listApplicants = asyncHandler(async (req: Request, res: Response) => {
  const data = await openingService.listApplicants(String(req.params.id), res.locals.user);
  res.json({ success: true, data });
});

// Recruiter: create.
export const createOpening = asyncHandler(async (req: Request, res: Response) => {
  const opening = await openingService.create(String(res.locals.user._id), req.body);
  res.status(201).json({ success: true, message: 'Opening posted', data: opening });
});

// Recruiter/owner: update.
export const updateOpening = asyncHandler(async (req: Request, res: Response) => {
  const opening = await openingService.update(String(req.params.id), res.locals.user, req.body);
  res.json({ success: true, message: 'Opening updated', data: opening });
});

// Recruiter/owner: open/close.
export const setOpeningStatus = asyncHandler(async (req: Request, res: Response) => {
  const opening = await openingService.setStatus(String(req.params.id), res.locals.user, req.body.status);
  res.json({ success: true, message: 'Opening status updated', data: opening });
});

// Recruiter/owner: delete.
export const deleteOpening = asyncHandler(async (req: Request, res: Response) => {
  const result = await openingService.remove(String(req.params.id), res.locals.user);
  res.json({ success: true, message: 'Opening deleted', data: result });
});
