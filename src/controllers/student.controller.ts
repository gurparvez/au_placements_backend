import { Request, Response } from 'express';
import { Student } from '../models/student.model';
import { uploadToCloudinary } from '../utils/uploadToCloudinary';

export const createStudentProfile = async (req: Request, res: Response) => {
  try {
    const user = res.locals.user;
    const existing = await Student.findOne({ user: user._id });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Profile already exists',
      });
    }

    let profileImageUrl = '';

    if (req.file) {
      console.log('File received in memory. Size:', req.file.size); // Log size for debug

      // CHANGE THIS: Pass req.file.buffer instead of req.file.path
      const uploaded: any = await uploadToCloudinary(
        req.file.buffer, // <--- Use buffer
        'students/profile_images'
      );

      console.log('Cloudinary upload complete:', uploaded?.public_id);
      profileImageUrl = uploaded.secure_url;
    }

    const profile = await Student.create({
      user: user._id,
      profile_image: profileImageUrl || undefined,
      ...req.body,
    });

    res.status(201).json({
      success: true,
      profile,
    });
  } catch (err) {
    console.log('createStudentProfile ERROR:', err);
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
  console.log('--- START UPDATE PROFILE REQUEST ---'); // Checkpoint A
  try {
    const user = res.locals.user;
    console.log('STEP 1: User ID found:', user?._id);

    let profileImageUrl;

    if (req.file) {
      console.log('File received in memory. Size:', req.file.size); // Log size for debug

      // CHANGE THIS: Pass req.file.buffer instead of req.file.path
      const uploaded: any = await uploadToCloudinary(
        req.file.buffer, // <--- Use buffer
        'students/profile_images'
      );

      console.log('Cloudinary upload complete:', uploaded?.public_id);
      profileImageUrl = uploaded.secure_url;
    } else {
      console.log('STEP 2: No file uploaded, skipping Cloudinary.');
    }

    const updateData: any = { ...req.body };

    if (profileImageUrl) {
      updateData.profile_image = profileImageUrl;
    }

    console.log('STEP 5: Updating MongoDB...');
    const updated = await Student.findOneAndUpdate(
      { user: user._id },
      { $set: updateData },
      { new: true }
    );
    console.log('STEP 6: MongoDB update success');

    res.json(updated);
  } catch (err: any) {
    // FORCE ERROR TO PRINT
    console.error('!!! CRITICAL ERROR CAUGHT !!!');
    console.error('Error Message:', err.message);
    console.error('Full Error Object:', JSON.stringify(err, null, 2));

    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
};

export const getAllStudents = async (req: Request, res: Response) => {
  try {
    const students = await Student.find({})
      .select("headline location skills projects profile_image user")
      .populate("skills")
      .populate("user", "firstName lastName auid");

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
};
