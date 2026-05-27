import { Request, Response } from 'express';
import { RecruiterService } from '../services/recruiter.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/handler';

const recruiterService = new RecruiterService();

export const createRecruiterRequest = asyncHandler(async (req: Request, res: Response) => {
  const request = await recruiterService.createRequest(req.body);
  res.status(201).json({
    success: true,
    message: 'Recruiter account request submitted.',
    data: request,
  });
});

export const listRecruiterRequests = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const requests = await recruiterService.listRequests(user, {
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
  });
  res.json({ success: true, data: requests });
});

export const reviewRecruiterRequest = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const result = await recruiterService.reviewRequest(req.params.requestId, user, req.body);
  res.json({
    success: true,
    message: 'Recruiter account request reviewed.',
    data: result,
  });
});
