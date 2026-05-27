import mongoose, { Document, Schema, Types } from 'mongoose';

type ApplicationStatus =
  | 'Applied'
  | 'Shortlisted'
  | 'InterviewScheduled'
  | 'Selected'
  | 'Rejected'
  | 'Offer Accepted'
  | 'Offer Declined';

interface IApplication extends Document {
  student: Types.ObjectId;
  user: Types.ObjectId;
  listing: Types.ObjectId;
  applied_at: Date;
  current_status: ApplicationStatus;
  status_history: {
    status: ApplicationStatus;
    note?: string;
    updated_at: Date;
  }[];
  eligibility_snapshot: {
    eligible: boolean;
    reasons: string[];
  };
}

const ApplicationSchema = new Schema<IApplication>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    listing: { type: Schema.Types.ObjectId, ref: 'JobListing', required: true, index: true },
    applied_at: { type: Date, default: Date.now },
    current_status: {
      type: String,
      enum: [
        'Applied',
        'Shortlisted',
        'InterviewScheduled',
        'Selected',
        'Rejected',
        'Offer Accepted',
        'Offer Declined',
      ],
      default: 'Applied',
    },
    status_history: {
      type: [
        {
          status: {
            type: String,
            enum: [
              'Applied',
              'Shortlisted',
              'InterviewScheduled',
              'Selected',
              'Rejected',
              'Offer Accepted',
              'Offer Declined',
            ],
            required: true,
          },
          note: { type: String },
          updated_at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    eligibility_snapshot: {
      eligible: { type: Boolean, required: true },
      reasons: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

ApplicationSchema.index({ user: 1, listing: 1 }, { unique: true });

const Application = mongoose.model<IApplication>('Application', ApplicationSchema);

export { Application };
export type { ApplicationStatus, IApplication };
