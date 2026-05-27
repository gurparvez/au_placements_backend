import mongoose, { Document, Schema, Types } from 'mongoose';

interface IStudentProfileHistory extends Document {
  student: Types.ObjectId;
  user: Types.ObjectId;
  profile_version: number;
  snapshot: Record<string, any>;
  created_at: Date;
}

const StudentProfileHistorySchema = new Schema<IStudentProfileHistory>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    profile_version: {
      type: Number,
      required: true,
    },
    snapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    versionKey: false,
  }
);

StudentProfileHistorySchema.index({ user: 1, profile_version: -1 });

const StudentProfileHistory = mongoose.model<IStudentProfileHistory>(
  'StudentProfileHistory',
  StudentProfileHistorySchema
);

export { StudentProfileHistory };
export type { IStudentProfileHistory };
