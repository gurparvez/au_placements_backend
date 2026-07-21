import { Request, Response } from 'express';
import { analyticsService, type DashboardFilters } from '../services/analytics.service';
import { placementService } from '../services/placement.service';
import { tpoService } from '../services/tpo.service';
import { asyncHandler } from '../utils/handler';

/* ----------------------------- Analytics ----------------------------- */

/** Pull the dashboard filter set off the query string, ignoring blanks. */
function parseFilters(req: Request): DashboardFilters {
  const s = (k: string) => {
    const v = req.query[k];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const batch = s('batch_year');
  return {
    university: s('university'),
    department: s('department'),
    batch_year: batch && !Number.isNaN(Number(batch)) ? Number(batch) : undefined,
    course: s('course'),
    type: s('type'),
    from: s('from'),
    to: s('to'),
  };
}

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.overview(parseFilters(req));
  res.json({ success: true, data });
});

export const getFilterOptions = asyncHandler(async (_req: Request, res: Response) => {
  const data = await analyticsService.filterOptions();
  res.json({ success: true, data });
});

export const getUnplacedFinalYear = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.unplacedFinalYear(parseFilters(req));
  res.json({ success: true, data });
});

/* ----------------------------- Placements ---------------------------- */

export const listPlacements = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const result = await placementService.list({
    page,
    limit,
    type: req.query.type as string | undefined,
    status: req.query.status as string | undefined,
    q: req.query.q as string | undefined,
  });
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const createPlacement = asyncHandler(async (req: Request, res: Response) => {
  const doc = await placementService.create(req.body);
  res.status(201).json({ success: true, message: 'Placement recorded', data: doc });
});

export const updatePlacement = asyncHandler(async (req: Request, res: Response) => {
  const doc = await placementService.update(String(req.params.id), req.body);
  res.json({ success: true, message: 'Placement updated', data: doc });
});

export const deletePlacement = asyncHandler(async (req: Request, res: Response) => {
  const data = await placementService.remove(String(req.params.id));
  res.json({ success: true, message: 'Placement deleted', data });
});

export const placementFromApplication = asyncHandler(async (req: Request, res: Response) => {
  const doc = await placementService.fromApplication(String(req.params.applicationId), req.body);
  res.status(201).json({ success: true, message: 'Placement recorded', data: doc });
});

/* ----------------------------- TPO tooling ---------------------------- */

export const getPolicySettings = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await tpoService.getPolicy() });
});

export const updatePolicySettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await tpoService.updatePolicy(req.body);
  res.json({ success: true, message: 'Placement policy updated', data });
});

export const listInvitations = asyncHandler(async (req: Request, res: Response) => {
  const data = await tpoService.listInvitations({
    session: req.query.session ? Number(req.query.session) : undefined,
    stage: req.query.stage as string | undefined,
    q: req.query.q as string | undefined,
  });
  res.json({ success: true, data });
});

export const createInvitation = asyncHandler(async (req: Request, res: Response) => {
  const data = await tpoService.createInvitation(req.body);
  res.status(201).json({ success: true, message: 'Company added', data });
});

export const updateInvitation = asyncHandler(async (req: Request, res: Response) => {
  const data = await tpoService.updateInvitation(String(req.params.id), req.body);
  res.json({ success: true, message: 'Company updated', data });
});

export const deleteInvitation = asyncHandler(async (req: Request, res: Response) => {
  const data = await tpoService.removeInvitation(String(req.params.id));
  res.json({ success: true, message: 'Company removed', data });
});

export const updateStudentRecord = asyncHandler(async (req: Request, res: Response) => {
  const data = await tpoService.updateStudentRecord(String(req.params.userId), req.body);
  res.json({ success: true, message: 'Student record updated', data });
});
