import { Request, Response } from 'express';
import { departmentService } from '../services/department.service';
import { asyncHandler } from '../utils/handler';

// Public: the dropdown source for student/opening forms.
export const listDepartments = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = req.query.all === 'true' && res.locals.user?.roles?.includes('admin');
  const data = await departmentService.list(includeInactive);
  res.json({ success: true, data });
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const doc = await departmentService.create(req.body.name, req.body.code);
  res.status(201).json({ success: true, message: 'Department added', data: doc });
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const doc = await departmentService.update(String(req.params.id), req.body);
  res.json({ success: true, message: 'Department updated', data: doc });
});

export const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
  const data = await departmentService.remove(String(req.params.id));
  res.json({ success: true, message: 'Department removed', data });
});
