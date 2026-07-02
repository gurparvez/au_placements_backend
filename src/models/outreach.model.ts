import mongoose, { Document, Schema, Types } from 'mongoose';

/** Log of a recruiter's inbuilt "Email student" action. */
interface IOutreach extends Document {
  recruiter: Types.ObjectId; // sender (active recruiter)
  student: Types.ObjectId; // recipient user
  subject: string;
  body: string;
  status: 'sent' | 'failed';
  error?: string;
  sent_at: Date;
}

const OutreachSchema = new Schema<IOutreach>(
  {
    recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    error: { type: String },
    sent_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Outreach = mongoose.model<IOutreach>('Outreach', OutreachSchema);

export { Outreach };
export type { IOutreach };
