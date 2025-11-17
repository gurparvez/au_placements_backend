import bcrypt from 'bcrypt'
import jwt, { Secret, SignOptions } from 'jsonwebtoken'
import mongoose, { Document, Schema } from 'mongoose'
import { ApiError } from '../utils/ApiError'

interface IUser extends Document {
  auid: string
  password: string
  firstName: string
  lastName: string
  email: string
  phone: string
  roles: ('student' | 'admin')[]

  isPasswordCorrect(password: String): Promise<boolean>
  accessToken(): String
}

const userSchema: Schema = new Schema(
  {
    auid: {
      type: String,
      unique: true,
      required: true,
      index: true,
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
    },
    phone: {
      type: String,
      required: false,
      unique: true,
    },
    roles: {
      type: [String],
      enum: ['student', 'admin'],
      default: ['student'],
    },
  },
  {
    timestamps: true,
  }
)

userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next()
  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (err: any) {
    next(err)
  }
})
userSchema.methods.accessToken = function (): string {
  const secret: Secret | undefined = process.env.ACCESS_TOKEN_SECRET
  if (!secret) {
    throw new ApiError(400, 'Failed to get secret from env file.')
  }

  const options: SignOptions = {
    expiresIn: (process.env.ACCESS_TOKEN_EXPIRY as any) || 864000,
  }

  return jwt.sign(
    {
      _id: this._id,
      roles: this.roles,
    },
    secret,
    options
  )
}

userSchema.methods.isPasswordCorrect = async function (password: string) {
  return bcrypt.compare(password, this.password)
}

const User = mongoose.model<IUser>('User', userSchema)

export { User }
export type { IUser }
