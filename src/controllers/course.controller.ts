import { Request, Response } from 'express';
import { Course } from '../models/course.model';

export const addCourse = async (req: Request, res: Response) => {
  try {
    const { name, category } = req.body;

    const course = await Course.findOneAndUpdate(
      { name },
      { name, category },
      { upsert: true, new: true }
    );

    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add course' });
  }
};

export const searchCourses = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;

    const courses = await Course.find({
      name: { $regex: q, $options: 'i' },
    }).limit(10);

    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

export const getAllCourses = async (req: Request, res: Response) => {
  try {
    const courses = await Course.find({});
    res.json({ success: true, courses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

export const getCourseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ success: true, course });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch course' });
  }
};
