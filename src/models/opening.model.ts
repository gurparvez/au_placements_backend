import mongoose, { Document, Schema, Types } from 'mongoose';

interface IOpening extends Document {
  recruiter: Types.ObjectId;
  company: string; // denormalized from the recruiter profile
  title: string;
  description: string;
  type: 'internship' | 'job';
  work_mode?: 'onsite' | 'remote' | 'hybrid';
  location?: string;
  skills: Types.ObjectId[];
  eligible_universities: ('Akal University' | 'Eternal University')[];
  min_experience?: number; // months
  stipend_or_salary?: string;
  apply_url?: string;
  apply_by?: Date;
  status: 'open' | 'closed';
}

const OpeningSchema = new Schema<IOpening>(
  {
    recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['internship', 'job'], required: true },
    work_mode: { type: String, enum: ['onsite', 'remote', 'hybrid'] },
    location: { type: String },
    skills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    eligible_universities: [{ type: String, enum: ['Akal University', 'Eternal University'] }],
    min_experience: { type: Number },
    stipend_or_salary: { type: String },
    apply_url: { type: String },
    apply_by: { type: Date },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  },
  { timestamps: true }
);

// Query-shaped compound indexes:
OpeningSchema.index({ status: 1, createdAt: -1 });       // public browse (default)
OpeningSchema.index({ recruiter: 1, createdAt: -1 });    // "my openings" + company profile
OpeningSchema.index({ eligible_universities: 1, status: 1 }); // filter by university

const Opening = mongoose.model<IOpening>('Opening', OpeningSchema);

export { Opening };
export type { IOpening };
