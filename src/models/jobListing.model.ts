import mongoose, { Document, Schema, Types } from 'mongoose';

type JobType = 'FullTime' | 'Internship' | 'Project' | 'Campus';
type JobStatus = 'Draft' | 'Active' | 'Closed';
type TargetUniversity = 'Akal University' | 'Eternal University' | 'Both';

interface IEligibilityCriteria {
  min_cgpa?: number;
  allowed_branches?: string[];
  allowed_programmes?: string[];
  allowed_batch_years?: number[];
  allowed_universities?: ('Akal University' | 'Eternal University')[];
  no_active_backlogs?: boolean;
  max_backlogs?: number;
}

interface IEligibilityResult {
  student: Types.ObjectId;
  user: Types.ObjectId;
  eligible: boolean;
  reasons: string[];
  computed_at: Date;
}

interface IEligibilityOverride {
  student: Types.ObjectId;
  user: Types.ObjectId;
  eligible: boolean;
  reason: string;
  overridden_by: Types.ObjectId;
  overridden_at: Date;
}

interface IJobListing extends Document {
  posted_by: Types.ObjectId;
  poster_type: 'Internal' | 'ThirdParty' | 'Admin';
  target_university: TargetUniversity;
  company_name: string;
  title: string;
  role: string;
  description: string;
  type: JobType;
  ctc_stipend?: string;
  location?: string;
  eligibility: IEligibilityCriteria;
  eligibility_results: IEligibilityResult[];
  eligibility_overrides: IEligibilityOverride[];
  deadline: Date;
  status: JobStatus;
  contact_person?: string;
}

const EligibilityCriteriaSchema = new Schema<IEligibilityCriteria>(
  {
    min_cgpa: { type: Number, min: 0, max: 10 },
    allowed_branches: { type: [String], default: [] },
    allowed_programmes: { type: [String], default: [] },
    allowed_batch_years: { type: [Number], default: [] },
    allowed_universities: {
      type: [String],
      enum: ['Akal University', 'Eternal University'],
      default: [],
    },
    no_active_backlogs: { type: Boolean, default: false },
    max_backlogs: { type: Number, min: 0 },
  },
  { _id: false }
);

const EligibilityResultSchema = new Schema<IEligibilityResult>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eligible: { type: Boolean, required: true },
    reasons: { type: [String], default: [] },
    computed_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EligibilityOverrideSchema = new Schema<IEligibilityOverride>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    eligible: { type: Boolean, required: true },
    reason: { type: String, required: true },
    overridden_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    overridden_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const JobListingSchema = new Schema<IJobListing>(
  {
    posted_by: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    poster_type: {
      type: String,
      enum: ['Internal', 'ThirdParty', 'Admin'],
      required: true,
      default: 'Admin',
    },
    target_university: {
      type: String,
      enum: ['Akal University', 'Eternal University', 'Both'],
      required: true,
      default: 'Both',
      index: true,
    },
    company_name: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['FullTime', 'Internship', 'Project', 'Campus'],
      required: true,
    },
    ctc_stipend: { type: String },
    location: { type: String },
    eligibility: { type: EligibilityCriteriaSchema, default: {} },
    eligibility_results: { type: [EligibilityResultSchema], default: [] },
    eligibility_overrides: { type: [EligibilityOverrideSchema], default: [] },
    deadline: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['Draft', 'Active', 'Closed'],
      default: 'Active',
      index: true,
    },
    contact_person: { type: String },
  },
  { timestamps: true }
);

JobListingSchema.index({ status: 1, deadline: 1, target_university: 1 });

const JobListing = mongoose.model<IJobListing>('JobListing', JobListingSchema);

export { JobListing };
export type {
  IEligibilityCriteria,
  IEligibilityOverride,
  IEligibilityResult,
  IJobListing,
  JobStatus,
  JobType,
};
