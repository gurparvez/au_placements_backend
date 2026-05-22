import { Request, Response } from 'express';
import { CourseService } from '../services/course.service';
import { getPagination } from '../utils/paginate';
import { asyncHandler } from '../utils/handler';

const courseService = new CourseService();

export const addCourse = asyncHandler(async (req: Request, res: Response) => {
  const { name, category } = req.body;
  const course = await courseService.addCourse(name, category);
  res.status(201).json({ success: true, data: course });
});

export const searchCourses = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query.q as string;
  const courses = await courseService.search(q);
  res.json({ success: true, data: courses });
});

export const getAllCourses = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const result = await courseService.getAll(page, limit, skip);
  res.json({ success: true, data: result.courses, pagination: result.pagination });
});

export const getCourseById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const course = await courseService.getById(id);
  res.json({ success: true, data: course });
});
