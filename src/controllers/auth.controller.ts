import { Request, Response } from 'express';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/handler';
import { verifyIdCard } from '../utils/verifyIdCard';

export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { auid, password, firstName, lastName, email, phone, roles, university } = req.body;

  if (!auid || !password || !firstName || !university || !req.file) {
    throw new ApiError(
      400,
      'AUID, password, firstName, university, and ID card image are required.'
    );
  }

  // Already existing?
  const existing = await User.findOne({ auid });
  if (existing) throw new ApiError(409, 'User with this AUID already exists.');

  // 🔥 Gemini Verification
  const { extracted_auid, extracted_university, is_valid_university, matches_auid } =
    await verifyIdCard(req.file.buffer, req.file.mimetype, auid);

  // 1. Check if ID card is valid and AUID matches
  if (!is_valid_university || !matches_auid) {
    throw new ApiError(
      400,
      `ID card verification failed. Expected AUID ${auid}, but extracted ${extracted_auid || 'none'}.`
    );
  }

  // 2. 🟢 Check if the extracted university matches the selected university
  // We use includes() because extracted text might be "Akal University, Talwandi Sabo"
  if (extracted_university && !extracted_university.includes(university)) {
    throw new ApiError(
      400,
      `ID card university mismatch. You selected "${university}", but the ID card belongs to "${extracted_university}".`
    );
  }

  const user = await User.create({
    auid,
    password,
    firstName,
    lastName,
    email,
    phone,
    university,
    roles: roles || ['student'],
    verified: true,
  });

  res.status(201).json({
    message: 'User registered successfully.',
    verified: true,
    user: {
      _id: user._id,
      auid: user.auid,
      firstName: user.firstName,
      university: user.university,
      roles: user.roles,
    },
  });
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { auid, password } = req.body;

  if (!auid || !password) {
    throw new ApiError(400, 'AUID and password are required.');
  }

  // Find user
  const user = await User.findOne({ auid });
  if (!user) {
    throw new ApiError(401, 'Invalid AUID or password.');
  }

  // Password check
  const isValid = await user.isPasswordCorrect(password);
  if (!isValid) {
    throw new ApiError(401, 'Invalid AUID or password.');
  }

  // Generate JWT token (Model method already updated to include university in payload)
  const token = user.accessToken();

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: parseInt(process.env.ACCESS_TOKEN_EXPIRY || '864000') * 1000,
  });

  res.json({
    message: 'Login successful',
    token,
    user: {
      _id: user._id,
      auid: user.auid,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      university: user.university, // 🟢 Return in response
      roles: user.roles,
    },
  });
});

export const updateUserInfo = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user; // authenticated user

  if (!user) throw new ApiError(401, 'Unauthorized');

  const { firstName, lastName, email, phone } = req.body;

  // Note: We deliberately do NOT allow updating 'university' here.
  // Changing university should require re-verification.

  const updated = await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(phone && { phone }),
      },
    },
    { new: true }
  );

  res.json({
    success: true,
    message: 'User info updated',
    user: {
      _id: updated?._id,
      auid: updated?.auid,
      firstName: updated?.firstName,
      lastName: updated?.lastName,
      email: updated?.email,
      phone: updated?.phone,
      university: updated?.university,
      roles: updated?.roles,
    },
  });
});

export const updatePassword = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;

  if (!user) throw new ApiError(401, 'Unauthorized');

  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, 'oldPassword and newPassword are required');
  }

  const dbUser = await User.findById(user._id);

  if (!dbUser) throw new ApiError(404, 'User not found');

  // Compare passwords
  const isCorrect = await dbUser.isPasswordCorrect(oldPassword);
  if (!isCorrect) throw new ApiError(401, 'Old password is incorrect');

  // Set new password (mongoose pre-save hook will hash it)
  dbUser.password = newPassword;
  await dbUser.save();

  res.json({
    success: true,
    message: 'Password updated successfully',
  });
});

export const logoutUser = (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'none',
  });

  res.json({ success: true, message: 'Logged out successfully' });
};

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user; // Comes from verifyJwt

  if (!user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  // We need to fetch the full user from DB to ensure we get the latest data
  // (though usually verifyJwt attaches enough info, fetching ensures we get fields like university if not in token)
  const dbUser = await User.findById(user._id);

  if (!dbUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({
    success: true,
    user: {
      _id: dbUser._id,
      auid: dbUser.auid,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      email: dbUser.email,
      phone: dbUser.phone,
      university: dbUser.university,
      roles: dbUser.roles,
    },
  });
});
