import mongoose, { Document, Schema, Types } from 'mongoose';

/** A student's application to an opening. One per (opening, student). */
interface IApplication extends Document {
  opening: Types.ObjectId;
  student: Types.ObjectId;   // applicant user
  recruiter: Types.ObjectId; // opening owner, for quick lookups
  status: 'applied' | 'reviewed' | 'shortlisted' | 'rejected';
}

const ApplicationSchema = new Schema<IApplication>(
  {
    opening: { type: Schema.Types.ObjectId, ref: 'Opening', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['applied', 'reviewed', 'shortlisted', 'rejected'], default: 'applied' },
  },
  { timestamps: true }
);

// A student can apply to a given opening only once.
ApplicationSchema.index({ opening: 1, student: 1 }, { unique: true });

const Application = mongoose.model<IApplication>('Application', ApplicationSchema);

export { Application };
export type { IApplication };
