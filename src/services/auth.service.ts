import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';

export class AuthService {
  async login(auid: string, password: string) {
    const user = await User.findOne({ auid });
    if (!user) throw new ApiError(401, 'Invalid AUID or password.');

    const isValid = await user.isPasswordCorrect(password);
    if (!isValid) throw new ApiError(401, 'Invalid AUID or password.');

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
