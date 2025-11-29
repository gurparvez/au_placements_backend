import { Request, Response } from 'express';
import { Student } from '../models/student.model';
import { User } from '../models/user.model';
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

    // Initialize studentData from body
    const studentData = { ...req.body };

    /* -------------------------------------------------------------------------- */
    /* FILE UPLOADS (Image & Resume)                                            */
    /* -------------------------------------------------------------------------- */

    // Cast req.files to the specific Multer type for multiple fields
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // 1. Handle Profile Image
    if (files && files['profile_image'] && files['profile_image'][0]) {
      const imageFile = files['profile_image'][0];
      console.log('Image received:', imageFile.originalname, imageFile.size);

      const uploaded: any = await uploadToCloudinary(imageFile.buffer, 'students/profile_images');

      studentData.profile_image = uploaded.secure_url;
    }

    // 2. Handle Resume
    if (files && files['resume'] && files['resume'][0]) {
      const resumeFile = files['resume'][0];
      console.log('Resume received:', resumeFile.originalname, resumeFile.size);

      // Upload to a different folder, e.g., 'students/resumes'
      // Note: Cloudinary handles PDFs automatically.
      // If you are uploading .doc/.docx, Cloudinary accepts them as "raw" files usually.
      const uploaded: any = await uploadToCloudinary(resumeFile.buffer, 'students/resumes');

      // Save the URL into the resume_link field
      studentData.resume_link = uploaded.secure_url;
    }

    /* -------------------------------------------------------------------------- */
    /* PARSE JSON STRINGS FROM BODY                                             */
    /* -------------------------------------------------------------------------- */
    // Since we are using FormData, complex fields come in as JSON strings.

    const fieldsToParse = [
      'education',
      'experience',
      'projects',
      'certificates',
      'skills',
      'looking_for',
    ];

    fieldsToParse.forEach((field) => {
      if (studentData[field] && typeof studentData[field] === 'string') {
        try {
          studentData[field] = JSON.parse(studentData[field]);
        } catch (error) {
          console.error(`Error parsing field ${field}:`, error);
          // Allow Mongoose validation to catch invalid structures later
        }
      }
    });

    /* -------------------------------------------------------------------------- */
    /* CREATE PROFILE                                                           */
    /* -------------------------------------------------------------------------- */

    const profile = await Student.create({
      user: user._id,
      ...studentData,
      // profile_image and resume_link are now merged into studentData if uploads occurred
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

export const getAnyStudentProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId (string) is required in query params' });
    }

    // Fetch student profile
    const profile = await Student.findOne({ user: userId })
      .populate('skills')
      .populate('education.course');

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Fetch full user info
    const user = await User.findById(userId).select(
      '-password -__v' // hide sensitive fields
    );

    res.json({
      success: true,
      user,
      profile,
    });
  } catch (err) {
    console.log('getAnyStudentProfile ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const updateStudentProfile = async (req: Request, res: Response) => {
  console.log('--- START UPDATE PROFILE REQUEST ---');
  try {
    const user = res.locals.user;
    console.log('STEP 1: User ID found:', user?._id);

    // Initialize updateData from body (cloned)
    const updateData: any = { ...req.body };

    /* -------------------------------------------------------------------------- */
    /* 1. HANDLE FILE UPLOADS (Image & Resume)                                  */
    /* -------------------------------------------------------------------------- */
    
    // Cast req.files to handle multiple fields
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // A. Handle Profile Image
    if (files && files['profile_image'] && files['profile_image'][0]) {
      const imageFile = files['profile_image'][0];
      console.log('Profile Image received. Size:', imageFile.size);

      const uploaded: any = await uploadToCloudinary(
        imageFile.buffer, 
        'students/profile_images'
      );

      console.log('Image Cloudinary upload complete:', uploaded?.public_id);
      updateData.profile_image = uploaded.secure_url;
    }

    // B. Handle Resume
    if (files && files['resume'] && files['resume'][0]) {
      const resumeFile = files['resume'][0];
      console.log('Resume received. Size:', resumeFile.size);

      const uploaded: any = await uploadToCloudinary(
        resumeFile.buffer, 
        'students/resumes'
      );

      console.log('Resume Cloudinary upload complete:', uploaded?.public_id);
      updateData.resume_link = uploaded.secure_url;
    }

    /* -------------------------------------------------------------------------- */
    /* 2. PARSE JSON STRINGS (Fix for FormData "CastError")                     */
    /* -------------------------------------------------------------------------- */
    
    const fieldsToParse = [
      'education',
      'experience',
      'projects',
      'certificates',
      'skills',
      'looking_for',
    ];

    fieldsToParse.forEach((field) => {
      // If the field exists and is a string, parse it back to an Object/Array
      if (updateData[field] && typeof updateData[field] === 'string') {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (error) {
          console.error(`Error parsing field ${field}:`, error);
          // We catch here so we don't crash everything,
          // but Mongoose might still throw validation error if data is bad.
        }
      }
    });

    /* -------------------------------------------------------------------------- */
    /* 3. UPDATE MONGODB                                                        */
    /* -------------------------------------------------------------------------- */
    console.log('STEP 5: Updating MongoDB...');

    // $set: updateData will replace the fields provided in updateData.
    // Mongoose will correctly save the parsed arrays/objects.
    const updated = await Student.findOneAndUpdate(
      { user: user._id },
      { $set: updateData },
      { new: true, runValidators: true } // runValidators ensures enums/types are checked
    );

    if (!updated) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    console.log('STEP 6: MongoDB update success');

    res.json(updated);
  } catch (err: any) {
    // FORCE ERROR TO PRINT
    console.error('!!! CRITICAL ERROR CAUGHT !!!');
    console.error('Error Message:', err.message);

    // Often Mongoose errors are inside err.errors, so printing the whole obj helps
    console.error('Full Error Object:', JSON.stringify(err, null, 2));

    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
};

export const getAllStudents = async (req: Request, res: Response) => {
  try {
    const students = await Student.find({})
      .populate('skills')
      .populate('education.course')
      .populate('user', 'firstName lastName auid');

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};
