import { Request, Response } from 'express';
import { StudentService } from '../services/student.service';
import { getPagination } from '../utils/paginate';
import { asyncHandler } from '../utils/handler';

const studentService = new StudentService();

export const createStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  const profile = await studentService.createProfile(user._id, req.body, files);
  res.status(201).json({ success: true, message: 'Profile created', data: profile });
});

export const getStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.user;
  const profile = await studentService.getProfile(userId);
  res.json({ success: true, data: profile });
});

export const getAnyStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ success: false, message: 'userId (string) is required in query params' });
  }

  const result = await studentService.getProfileByUserId(userId);
  res.json({ success: true, data: result });
});

export const updateStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  const updated = await studentService.updateProfile(user._id, req.body, files);
  res.json({ success: true, message: 'Profile updated', data: updated });
});

export const reviewStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;

  const updated = await studentService.markProfileReviewed(user._id);
  res.json({ success: true, message: 'Profile review confirmed', data: updated });
});

export const getStudentProfileHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;

  const history = await studentService.getProfileHistory(user._id);
  res.json({ success: true, data: history });
});

export const getAllStudents = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const result = await studentService.getAllStudents(page, limit, skip);
  res.json({ success: true, data: result.students, pagination: result.pagination });
});
