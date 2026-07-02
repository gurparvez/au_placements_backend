import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';

export class AuthService {
  async login(identifier: string, password: string) {
    // Students sign in with their AUID, recruiters/admins with their email.
    const user = await User.findOne({ $or: [{ auid: identifier }, { email: identifier }] });
    if (!user) throw new ApiError(401, 'Invalid credentials.');

    const isValid = await user.isPasswordCorrect(password);
    if (!isValid) throw new ApiError(401, 'Invalid credentials.');

    // Only active accounts may sign in.
    if (user.status !== 'active') {
      const message =
        user.status === 'pending'
          ? 'Your account is awaiting admin approval.'
          : user.status === 'rejected'
            ? 'Your account request was not approved.'
            : 'Your account has been suspended.';
      throw new ApiError(403, message);
    }

    const token = user.accessToken();

    return {
      token,
      user: {
        _id: user._id,
        auid: user.auid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        university: user.university,
        roles: user.roles,
        status: user.status,
      },
    };
  }

  async getUserById(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    return {
      _id: user._id,
      auid: user.auid,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      university: user.university,
      roles: user.roles,
      status: user.status,
    };
  }

  async updateUserInfo(userId: string, data: { firstName?: string; lastName?: string; email?: string; phone?: string }) {
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          ...(data.firstName && { firstName: data.firstName }),
          ...(data.lastName && { lastName: data.lastName }),
          ...(data.email && { email: data.email }),
          ...(data.phone && { phone: data.phone }),
        },
      },
      { new: true }
    );

    if (!updated) throw new ApiError(404, 'User not found');

    return {
      _id: updated._id,
      auid: updated.auid,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone,
      university: updated.university,
      roles: updated.roles,
    };
  }

  async updatePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');

    const isCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isCorrect) throw new ApiError(401, 'Old password is incorrect');

    user.password = newPassword;
    await user.save();
  }
}
