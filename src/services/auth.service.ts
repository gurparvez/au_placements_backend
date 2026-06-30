import { User, IUser } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { verifyIdCard } from '../utils/verifyIdCard';
import { CONFIG } from '../config/environment';

export class AuthService {
  async register(data: {
    auid: string;
    password: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    university: string;
    idCardBuffer?: Buffer;
    idCardMimetype?: string;
  }) {
    const { auid, password, firstName, lastName, email, phone, university, idCardBuffer, idCardMimetype } = data;

    const existing = await User.findOne({ auid });
    if (existing) throw new ApiError(409, 'User with this AUID already exists.');

    // ID card verification via Gemini — only when a card was uploaded AND a
    // GEMINI_API_KEY is configured. Otherwise it's skipped (dev/local), so the
    // ID card is not compulsory for now.
    let verified = false;
    if (CONFIG.geminiApiKey && idCardBuffer && idCardMimetype) {
      const { extracted_auid, extracted_university, is_valid_university, matches_auid } =
        await verifyIdCard(idCardBuffer, idCardMimetype, auid);

      if (!is_valid_university || !matches_auid) {
        throw new ApiError(
          400,
          `ID card verification failed. Expected AUID ${auid}, but extracted ${extracted_auid || 'none'}.`
        );
      }

      const normalizedExtracted = extracted_university?.toLowerCase() || '';
      const normalizedSelected = university.toLowerCase();

      if (!normalizedExtracted.includes(normalizedSelected)) {
        throw new ApiError(
          400,
          `ID card university mismatch. You selected "${university}", but the ID card belongs to "${extracted_university}".`
        );
      }

      verified = true;
    } else {
      console.warn(
        '[auth] Skipping ID-card verification (no GEMINI_API_KEY configured or no card uploaded).'
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
      roles: ['student'],
      verified,
    });

    return {
      _id: user._id,
      auid: user.auid,
      firstName: user.firstName,
      university: user.university,
      roles: user.roles,
    };
  }

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
