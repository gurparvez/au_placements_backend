import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Recruiter / company profile, 1:1 with a `User` whose roles include 'recruiter'.
 * Approval state itself lives on `user.status` (pending/active/rejected); this
 * document holds the company details and review bookkeeping.
 */
interface IRecruiter extends Document {
  user: Types.ObjectId;
  company: string;
  company_website?: string;
  company_logo?: string;
  industry?: string;
  company_size?: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  designation?: string;
  work_email?: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  about?: string;
  reviewed_by?: Types.ObjectId;
  reviewed_at?: Date;
  rejection_reason?: string;
}

const RecruiterSchema = new Schema<IRecruiter>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    company: { type: String, required: true },
    company_website: { type: String },
    company_logo: { type: String },
    industry: { type: String },
    company_size: { type: String, enum: ['1-10', '11-50', '51-200', '201-500', '500+'] },
    designation: { type: String },
    work_email: { type: String },
    phone: { type: String },
    location: { type: String },
    linkedin_url: { type: String },
    about: { type: String },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
    rejection_reason: { type: String },
  },
  { timestamps: true }
);

const Recruiter = mongoose.model<IRecruiter>('Recruiter', RecruiterSchema);

export { Recruiter };
export type { IRecruiter };
