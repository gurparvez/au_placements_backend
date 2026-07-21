import bcrypt from 'bcrypt';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import mongoose, { Document, Schema } from 'mongoose';
import { ApiError } from '../utils/ApiError';

type Role = 'student' | 'recruiter' | 'admin';
type UserStatus = 'active' | 'pending' | 'suspended' | 'rejected';

interface IUser extends Document {
  auid?: string; // students only
  password: string;
  firstName: string;
  lastName: string;
  email?: string; // login id for recruiter/admin
  phone?: string;

  university?: 'Akal University' | 'Eternal University'; // students only
  gender?: 'male' | 'female' | 'other'; // required for NIRF/NBA placement reporting

  roles: Role[];
  status: UserStatus;

  isPasswordCorrect(password: String): Promise<boolean>;
  accessToken(): String;
}

const userSchema: Schema = new Schema(
  {
    auid: {
      type: String,
      unique: true,
      sparse: true, // students have one; recruiters/admin may not
      required: false,
    },
    password: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      lowercase: true,
    },
    lastName: {
      type: String,
      required: false,
      lowercase: true,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },

    university: {
      type: String,
      enum: ['Akal University', 'Eternal University'],
      required: false, // students only
    },

    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: false,
    },

    roles: {
      type: [String],
      enum: ['student', 'recruiter', 'admin'],
      default: ['student'],
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'rejected'],
      default: 'active',
      index: true,
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
      university: this.university, // Optional: useful to have university in the token payload
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
export type { IUser, Role, UserStatus };
