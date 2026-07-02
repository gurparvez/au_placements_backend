import mongoose, { Document, Schema, Types } from 'mongoose';

/** A user (typically a student) following a company — represented by its recruiter user. */
interface IFollow extends Document {
  follower: Types.ObjectId;
  company: Types.ObjectId; // recruiter user being followed
}

const FollowSchema = new Schema<IFollow>(
  {
    follower: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

FollowSchema.index({ follower: 1, company: 1 }, { unique: true });

const Follow = mongoose.model<IFollow>('Follow', FollowSchema);

export { Follow };
export type { IFollow };
