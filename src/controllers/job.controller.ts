import { Request, Response } from 'express';
import { JobService } from '../services/job.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/handler';

const jobService = new JobService();

export const createJob = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const job = await jobService.createJob(user, req.body);
  res.status(201).json({ success: true, message: 'Job listing created', data: job });
});

export const updateJob = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const job = await jobService.updateJob(req.params.jobId, user, req.body);
  res.json({ success: true, message: 'Job listing updated', data: job });
});

export const listJobs = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await jobService.getJobs(req.query, res.locals.user);
  res.json({ success: true, data: jobs });
});

export const getJob = asyncHandler(async (req: Request, res: Response) => {
  const job = await jobService.getJobById(req.params.jobId, res.locals.user);
  res.json({ success: true, data: job });
});

export const recomputeJobEligibility = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user?.roles?.some((role: string) => ['admin', 'tpo'].includes(role))) {
    throw new ApiError(403, 'Only admin/TPO users can recompute eligibility.');
  }

  const job = await jobService.recomputeEligibility(req.params.jobId);
  res.json({ success: true, message: 'Eligibility recomputed', data: job });
});

export const overrideJobEligibility = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const job = await jobService.overrideEligibility(req.params.jobId, user, req.body);
  res.json({ success: true, message: 'Eligibility override saved', data: job });
});

export const applyToJob = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const application = await jobService.apply(req.params.jobId, user);
  res.status(201).json({ success: true, message: 'Application submitted', data: application });
});

export const getMyApplications = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const applications = await jobService.myApplications(user);
  res.json({ success: true, data: applications });
});

export const getJobApplicants = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const applications = await jobService.getApplicants(req.params.jobId, user);
  res.json({ success: true, data: applications });
});

export const updateApplicationStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const application = await jobService.updateApplicationStatus(
    req.params.jobId,
    req.params.applicationId,
    user,
    req.body
  );
  res.json({ success: true, message: 'Application status updated', data: application });
});
