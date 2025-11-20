import { Request, Response } from 'express';
import { Student } from '../models/student.model';

export const createStudentProfile = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user; // coming from auth middleware

    const studentExists = await Student.findOne({ user: userId });
    if (studentExists) return res.status(400).json({ error: 'Profile already exists' });

    const profile = await Student.create({
      user: userId,
      location: req.body.location,
      ...req.body,
    });

    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create profile' });
  }
};

export const getStudentProfile = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user;

    const profile = await Student.findOne({ user: userId })
      .populate('skills')
      .populate('education.course');

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const updateStudentProfile = async (req: Request, res: Response) => {
  try {
    const userId = res.locals.user;

    const updated = await Student.findOneAndUpdate(
      { user: userId },
      { $set: req.body },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
