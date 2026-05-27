import mongoose, { Document, Schema, Types } from 'mongoose';

type RecruiterRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'MoreInfoRequested';

interface IRecruiterAccountRequest extends Document {
  company_name: string;
  cin_registration_number: string;
  contact_person: string;
  designation: string;
  official_email: string;
  phone: string;
  website?: string;
  company_brief: string;
  status: RecruiterRequestStatus;
  decision_note?: string;
  reviewed_by?: Types.ObjectId;
  reviewed_at?: Date;
  approved_user?: Types.ObjectId;
}

const RecruiterAccountRequestSchema = new Schema<IRecruiterAccountRequest>(
  {
    company_name: { type: String, required: true, trim: true },
    cin_registration_number: { type: String, required: true, trim: true, index: true },
    contact_person: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    official_email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    company_brief: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'MoreInfoRequested'],
      default: 'Pending',
      index: true,
    },
    decision_note: { type: String, trim: true },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    approved_user: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

RecruiterAccountRequestSchema.index({ official_email: 1, status: 1 });

const RecruiterAccountRequest = mongoose.model<IRecruiterAccountRequest>(
  'RecruiterAccountRequest',
  RecruiterAccountRequestSchema
);

export { RecruiterAccountRequest };
export type { IRecruiterAccountRequest, RecruiterRequestStatus };
