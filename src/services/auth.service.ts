import { User, IUser } from '../models/user.model';
import { CONFIG } from '../config/environment';
import { ApiError } from '../utils/ApiError';
import { createRawToken, hashToken } from '../utils/tokens';
import { isOfficialUniversityEmail, officialEmailDomainsFor } from '../utils/university';
import { verifyIdCard } from '../utils/verifyIdCard';

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export class AuthService {
  private buildEmailVerificationUrl(token: string) {
    return `${CONFIG.frontendBaseUrl}/verify-email?token=${token}`;
  }

  private buildPasswordResetUrl(token: string) {
    return `${CONFIG.frontendBaseUrl}/reset-password?token=${token}`;
  }

  private createEmailVerificationFields() {
    const token = createRawToken();
    return {
      token,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
    };
  }

  private createPasswordResetFields() {
    const token = createRawToken();
    return {
      token,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    };
  }

  async register(data: {
    auid: string;
    password: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    university: string;
    programme: string;
    branch_department: string;
    batch_year: number;
    idCardBuffer: Buffer;
    idCardMimetype: string;
  }) {
    const {
      auid,
      password,
      firstName,
      lastName,
      email,
      phone,
      university,
      programme,
      branch_department,
      batch_year,
      idCardBuffer,
      idCardMimetype,
    } = data;

    const existing = await User.findOne({ auid });
    if (existing) throw new ApiError(409, 'User with this AUID already exists.');

    if (!email || !isOfficialUniversityEmail(email, university)) {
      const allowedDomains = officialEmailDomainsFor(university).join(', ');
      throw new ApiError(
        400,
        `Use an official ${university} email address${allowedDomains ? ` (${allowedDomains})` : ''}.`
      );
    }

    const { extracted_auid, extracted_university, is_valid_university, matches_auid, ocr_error } =
      await verifyIdCard(idCardBuffer, idCardMimetype, auid, university);

    if (!is_valid_university || !matches_auid) {
      throw new ApiError(
        400,
        `ID card verification failed. Expected AUID ${auid}, but extracted ${extracted_auid || 'none'}.${ocr_error ? ` OCR error: ${ocr_error}` : ''}`
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

    const verification = this.createEmailVerificationFields();

    const user = await User.create({
      auid,
      password,
      firstName,
      lastName,
      email,
      phone,
      university,
      programme,
      branch_department,
      batch_year,
      account_type: 'student',
      roles: ['student'],
      verified: true,
      email_verified: false,
      email_verification_token_hash: verification.tokenHash,
      email_verification_expires_at: verification.expiresAt,
    });

    return {
      _id: user._id,
      auid: user.auid,
      firstName: user.firstName,
      account_type: user.account_type,
      university: user.university,
      programme: user.programme,
      branch_department: user.branch_department,
      batch_year: user.batch_year,
      email_verified: user.email_verified,
      email_verification:
        CONFIG.env === 'production'
          ? undefined
          : {
              token: verification.token,
              verificationUrl: this.buildEmailVerificationUrl(verification.token),
            },
      roles: user.roles,
    };
  }

  async login(identifier: string, password: string) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ auid: identifier.trim() }, { email: normalizedIdentifier }],
    });
    if (!user) throw new ApiError(401, 'Invalid login or password.');

    const isValid = await user.isPasswordCorrect(password);
    if (!isValid) throw new ApiError(401, 'Invalid login or password.');

    if (!user.email_verified) {
      throw new ApiError(403, 'Please verify your email before logging in.');
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
        account_type: user.account_type,
        university: user.university,
        programme: user.programme,
        branch_department: user.branch_department,
        batch_year: user.batch_year,
        company_name: user.company_name,
        email_verified: user.email_verified,
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
      account_type: user.account_type,
      university: user.university,
      programme: user.programme,
      branch_department: user.branch_department,
      batch_year: user.batch_year,
      company_name: user.company_name,
      email_verified: user.email_verified,
      roles: user.roles,
    };
  }

  async updateUserInfo(userId: string, data: { firstName?: string; lastName?: string; email?: string; phone?: string }) {
    const existing = await User.findById(userId);
    if (!existing) throw new ApiError(404, 'User not found');

    if (data.email && existing.account_type === 'student' && existing.university && !isOfficialUniversityEmail(data.email, existing.university)) {
      const allowedDomains = officialEmailDomainsFor(existing.university).join(', ');
      throw new ApiError(
        400,
        `Use an official ${existing.university} email address${allowedDomains ? ` (${allowedDomains})` : ''}.`
      );
    }

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
      account_type: updated.account_type,
      university: updated.university,
      programme: updated.programme,
      branch_department: updated.branch_department,
      batch_year: updated.batch_year,
      company_name: updated.company_name,
      email_verified: updated.email_verified,
      roles: updated.roles,
    };
  }

  async verifyEmail(token: string) {
    const tokenHash = hashToken(token);
    const user = await User.findOne({
      email_verification_token_hash: tokenHash,
      email_verification_expires_at: { $gt: new Date() },
    }).select('+email_verification_token_hash +email_verification_expires_at');

    if (!user) throw new ApiError(400, 'Invalid or expired email verification token.');

    user.email_verified = true;
    user.email_verification_token_hash = undefined;
    user.email_verification_expires_at = undefined;
    await user.save();

    return {
      _id: user._id,
      auid: user.auid,
      email: user.email,
      email_verified: user.email_verified,
    };
  }

  async resendVerification(identifier: { email?: string; auid?: string }) {
    const user = await User.findOne(
      identifier.email ? { email: identifier.email } : { auid: identifier.auid }
    );

    if (!user) {
      return { sent: true };
    }

    if (user.email_verified) {
      return { sent: true, alreadyVerified: true };
    }

    const verification = this.createEmailVerificationFields();
    user.email_verification_token_hash = verification.tokenHash;
    user.email_verification_expires_at = verification.expiresAt;
    await user.save();

    return {
      sent: true,
      email: user.email,
      ...(CONFIG.env === 'production'
        ? {}
        : {
            token: verification.token,
            verificationUrl: this.buildEmailVerificationUrl(verification.token),
          }),
    };
  }

  async requestPasswordReset(identifier: { email?: string; auid?: string }) {
    const user = await User.findOne(
      identifier.email ? { email: identifier.email } : { auid: identifier.auid }
    );

    if (!user) {
      return { sent: true };
    }

    const reset = this.createPasswordResetFields();
    user.password_reset_token_hash = reset.tokenHash;
    user.password_reset_expires_at = reset.expiresAt;
    await user.save();

    return {
      sent: true,
      email: user.email,
      ...(CONFIG.env === 'production'
        ? {}
        : {
            token: reset.token,
            resetUrl: this.buildPasswordResetUrl(reset.token),
          }),
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const user = await User.findOne({
      password_reset_token_hash: tokenHash,
      password_reset_expires_at: { $gt: new Date() },
    }).select('+password_reset_token_hash +password_reset_expires_at +password');

    if (!user) throw new ApiError(400, 'Invalid or expired password reset token.');

    user.password = newPassword;
    user.password_reset_token_hash = undefined;
    user.password_reset_expires_at = undefined;
    await user.save();
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
