import { Request, Response } from 'express';
import { Student } from '../models/student.model';
import { uploadToCloudinary } from '../utils/uploadToCloudinary';
import { User } from '../models/user.model';

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

    /* -------------------------------------------------------------------------- */
    /* IMAGE UPLOAD                                 */
    /* -------------------------------------------------------------------------- */
    let profileImageUrl = '';

    if (req.file) {
      console.log('File received in memory. Size:', req.file.size);

      const uploaded: any = await uploadToCloudinary(
        req.file.buffer,
        'students/profile_images'
      );

      console.log('Cloudinary upload complete:', uploaded?.public_id);
      profileImageUrl = uploaded.secure_url;
    }

    /* -------------------------------------------------------------------------- */
    /* PARSE JSON STRINGS FROM BODY                       */
    /* -------------------------------------------------------------------------- */
    // FormData sends arrays/objects as JSON strings (e.g. "[{...}]"). 
    // We must parse them back to objects for Mongoose.
    
    const studentData = { ...req.body };
    const fieldsToParse = [
      'education', 
      'experience', 
      'projects', 
      'certificates', 
      'skills', 
      'looking_for'
    ];

    fieldsToParse.forEach((field) => {
      if (studentData[field] && typeof studentData[field] === 'string') {
        try {
          studentData[field] = JSON.parse(studentData[field]);
        } catch (error) {
          console.error(`Error parsing field ${field}:`, error);
          // If parsing fails, we leave it as is; Mongoose will throw a validation error.
        }
      }
    });

    /* -------------------------------------------------------------------------- */
    /* CREATE PROFILE                               */
    /* -------------------------------------------------------------------------- */

    const profile = await Student.create({
      user: user._id,
      profile_image: profileImageUrl || undefined,
      ...studentData, // <--- Use the parsed data here
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

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId (string) is required in query params" });
    }

    // Fetch student profile
    const profile = await Student.findOne({ user: userId })
      .populate("skills")
      .populate("education.course");

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Fetch full user info
    const user = await User.findById(userId).select(
      "-password -__v" // hide sensitive fields
    );

    res.json({
      success: true,
      user,
      profile,
    });

  } catch (err) {
    console.log("getAnyStudentProfile ERROR:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateStudentProfile = async (req: Request, res: Response) => {
  console.log('--- START UPDATE PROFILE REQUEST ---');
  try {
    const user = res.locals.user;
    console.log('STEP 1: User ID found:', user?._id);

    /* -------------------------------------------------------------------------- */
    /* 1. HANDLE IMAGE UPLOAD (If a new file exists)                              */
    /* -------------------------------------------------------------------------- */
    let profileImageUrl;

    if (req.file) {
      console.log('File received in memory. Size:', req.file.size);

      const uploaded: any = await uploadToCloudinary(
        req.file.buffer,
        'students/profile_images'
      );

      console.log('Cloudinary upload complete:', uploaded?.public_id);
      profileImageUrl = uploaded.secure_url;
    } else {
      console.log('STEP 2: No new file uploaded, skipping Cloudinary.');
    }

    /* -------------------------------------------------------------------------- */
    /* 2. PARSE JSON STRINGS (Fix for FormData "CastError")                       */
    /* -------------------------------------------------------------------------- */
    // Clone body so we can modify it
    const updateData: any = { ...req.body };

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

    // If a new image was uploaded, override the old one
    if (profileImageUrl) {
      updateData.profile_image = profileImageUrl;
    }

    /* -------------------------------------------------------------------------- */
    /* 3. UPDATE MONGODB                                                          */
    /* -------------------------------------------------------------------------- */
    console.log('STEP 5: Updating MongoDB...');

    // $set: updateData will replace the fields provided in updateData.
    // Since we parsed the arrays, Mongoose will correctly save them as arrays.
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
      .populate("skills")
      .populate("education.course")
      .populate("user", "firstName lastName auid");

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
};
