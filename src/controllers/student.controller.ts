import { Request, Response } from 'express';
import { Student } from '../models/student.model';

export const createStudentProfile = async (req: Request, res: Response) => {
  try {
    const user = res.locals.user;

    // Ensure profile doesn't already exist.
    const existing = await Student.findOne({ user: user._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A profile already exists for this user."
      });
    }

    delete req.body.user;

    const profile = await Student.create({
      user: user._id,        // ALWAYS enforced by backend
      ...req.body
    });

    res.status(201).json({
      success: true,
      profile
    });

  } catch (err) {
    console.log("createStudentProfile ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to create profile" });
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
    const userId = res.locals.user._id;

    const updated = await Student.findOneAndUpdate(
      { user: userId },
      { $set: req.body },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.log('updateStudentProfile ERROR:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
