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

export const getAllStudents = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const result = await studentService.getAllStudents(page, limit, skip);
  res.json({ success: true, data: result.students, pagination: result.pagination });
});

export const searchStudents = asyncHandler(async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const data = await studentService.searchStudents(q);
  res.json({ success: true, data });
});

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

// Public: filtered + paginated student directory (server-side).
export const browseStudents = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req);
  const rawSkills = req.query.skills;
  const skills = typeof rawSkills === 'string'
    ? rawSkills.split(',').map((s) => s.trim()).filter(Boolean)
    : Array.isArray(rawSkills)
      ? (rawSkills as string[]).map((s) => String(s).trim()).filter(Boolean)
      : undefined;

  const opp = str(req.query.opportunity);
  const exp = str(req.query.exp);
  const result = await studentService.browseStudents(
    {
      q: str(req.query.q),
      skills: skills && skills.length ? skills : undefined,
      university: str(req.query.university),
      opportunity: opp === 'internship' || opp === 'job' ? opp : undefined,
      field: str(req.query.field),
      exp: exp === '0-6' || exp === '6-12' || exp === '12-24' || exp === '24+' ? exp : undefined,
      from: str(req.query.from),
      to: str(req.query.to),
    },
    page,
    limit
  );
  res.json({ success: true, data: result.students, pagination: result.pagination });
});

// Public: distinct filter options (preferred fields, …).
export const studentFilterMeta = asyncHandler(async (_req: Request, res: Response) => {
  const data = await studentService.filterMeta();
  res.json({ success: true, data });
});
