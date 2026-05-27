import bcrypt from 'bcrypt';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import mongoose, { Document, Schema } from 'mongoose';
import { ApiError } from '../utils/ApiError';

type UserRole = 'student' | 'admin' | 'internal_poster' | 'recruiter' | 'tpo';
type AccountType = 'student' | 'admin' | 'internal' | 'recruiter';

interface IUser extends Document {
  auid?: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  account_type: AccountType;
  university?: 'Akal University' | 'Eternal University';
  programme?: string;
  branch_department?: string;
  batch_year?: number;
  company_name?: string;
  email_verified: boolean;
  email_verification_token_hash?: string;
  email_verification_expires_at?: Date;
  password_reset_token_hash?: string;
  password_reset_expires_at?: Date;

  roles: UserRole[];

  isPasswordCorrect(password: String): Promise<boolean>;
  accessToken(): String;
}

const userSchema: Schema = new Schema(
  {
    auid: {
      type: String,
      unique: true,
      sparse: true,
      required: false,
      index: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
    },

    account_type: {
      type: String,
      enum: ['student', 'admin', 'internal', 'recruiter'],
      default: 'student',
      index: true,
    },

    university: {
      type: String,
      enum: ['Akal University', 'Eternal University'],
      required: false,
    },
    programme: {
      type: String,
      required: false,
      trim: true,
    },
    branch_department: {
      type: String,
      required: false,
      trim: true,
    },
    batch_year: {
      type: Number,
      required: false,
      min: 2000,
      max: 2100,
    },
    company_name: {
      type: String,
      required: false,
      trim: true,
    },

    roles: {
      type: [String],
      enum: ['student', 'admin', 'internal_poster', 'recruiter', 'tpo'],
      default: ['student'],
    },
    verified: {
      type: Boolean,
      default: false,
    },
    email_verified: {
      type: Boolean,
      default: false,
    },
    email_verification_token_hash: {
      type: String,
      select: false,
    },
    email_verification_expires_at: {
      type: Date,
      select: false,
    },
    password_reset_token_hash: {
      type: String,
      select: false,
    },
    password_reset_expires_at: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

userSchema.methods.accessToken = function (): string {
  const secret: Secret | undefined = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new ApiError(400, 'Failed to get secret from env file.');
  }

  const options: SignOptions = {
    expiresIn: Number(process.env.ACCESS_TOKEN_EXPIRY) || 864000,
  };

  return jwt.sign(
    {
      _id: this._id,
      roles: this.roles,
      university: this.university,
      account_type: this.account_type,
    },
    secret,
    options
  );
};

userSchema.methods.isPasswordCorrect = async function (password: string) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model<IUser>('User', userSchema);

export { User };
export type { IUser };
