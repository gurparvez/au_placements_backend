import mongoose, { Document, Schema, Types } from 'mongoose';

/* ---------------------- Interfaces ---------------------- */

/**
 * Why a student is (or isn't) in the placement pool. Only 'placement' counts
 * towards the reported placement percentage — see analytics.service.
 */
export const PLACEMENT_INTENTS = [
  'placement',
  'higher_studies',
  'competitive_exam',
  'entrepreneurship',
  'family_business',
  'not_interested',
  'deferred',
] as const;
export type PlacementIntent = (typeof PLACEMENT_INTENTS)[number];

/** Labels for the outcome-composition chart. */
export const INTENT_LABELS: Record<PlacementIntent, string> = {
  placement: 'Seeking placement',
  higher_studies: 'Higher studies',
  competitive_exam: 'Competitive exams',
  entrepreneurship: 'Entrepreneurship',
  family_business: 'Family business',
  not_interested: 'Opted out',
  deferred: 'Deferred',
};

interface ILookingFor {
  type: 'internship' | 'job';
  from_date?: Date;
  to_date?: Date;
}

interface ICertificate {
  name: string;
  issued_by: string;
  issue_date: Date;
  certificate_url?: string;
  valid_until?: Date;
}

interface IExperience {
  company: string;
  role: string;
  start_date: Date;
  end_date?: Date;
  description?: string;
}

interface IProject {
  title: string;
  start_date: Date;
  end_date?: Date;
  on_going?: boolean;
  tech_used: Types.ObjectId[];
  code_url?: string;
  live_url?: string;
  description?: string;
}

interface IEducation {
  level: 'university' | 'school';
  institute: string;
  from_date?: Date;
  to_date?: Date;
  course?: Types.ObjectId; // university only
  specialization?: string; // university only
  board?: string; // school only (e.g. CBSE, ICSE, PSEB)
  grade?: string; // school only (e.g. 10th, 12th)
  passing_year?: number; // school only
}

interface IStudent extends Document {
  user: Types.ObjectId;

  headline?: string;
  location: string;
  about?: string;
  profile_image?: string;

  linkedin_url?: string;
  github_url?: string;
  resume_link?: string;

  preferred_field?: string;

  /* ---- Current academic record (drives TPC reporting: department / course / batch) ---- */
  department?: string;
  course?: Types.ObjectId; // current programme
  batch_year?: number; // expected graduation year — "batch of 2027"
  cgpa?: number;
  backlogs?: number;

  /**
   * Placement-cell registration. The reported placement percentage divides by
   * students whose intent is 'placement' — anyone pursuing higher studies or
   * otherwise opted out must leave the denominator, or the figure is wrong.
   */
  placement_intent?: PlacementIntent;
  opted_out_reason?: string;

  /* ---- Preparation signals: the only *leading* indicators we hold ---- */
  aptitude_score?: number; // 0–100, latest mock aptitude
  mock_interviews?: number; // sessions attended
  mock_interview_score?: number; // 0–10, latest rating
  training_attendance?: number; // 0–100 %
  resume_verified?: boolean;

  looking_for: ILookingFor;

  experience?: IExperience[];
  total_experience: number;

  projects?: IProject[];
  certificates?: ICertificate[];

  skills?: Types.ObjectId[];
  education?: IEducation[];
}

/* ---------------------- Sub Schemas ---------------------- */

const LookingForSchema = new Schema<ILookingFor>(
  {
    type: {
      type: String,
      enum: ['internship', 'job'],
      required: true,
    },
    from_date: { type: Date },
    to_date: { type: Date },
  },
  { _id: false }
);

const CertificateSchema = new Schema<ICertificate>({
  name: { type: String, required: true },
  issued_by: { type: String, required: true },
  issue_date: { type: Date, required: true },
  certificate_url: { type: String },
  valid_until: { type: Date },
});

const ExperienceSchema = new Schema<IExperience>({
  company: { type: String, required: true },
  role: { type: String, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date },
  description: { type: String },
});

const ProjectSchema = new Schema<IProject>({
  title: { type: String, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date },
  on_going: { type: Boolean, default: false },
  tech_used: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
  code_url: String,
  live_url: String,
  description: String,
});

const EducationSchema = new Schema<IEducation>({
  level: { type: String, enum: ['university', 'school'], default: 'university' },
  institute: { type: String, required: true },
  from_date: { type: Date },
  to_date: { type: Date },
  course: { type: Schema.Types.ObjectId, ref: 'Course' }, // university only
  specialization: { type: String }, // university only
  board: { type: String }, // school only
  grade: { type: String }, // school only
  passing_year: { type: Number }, // school only
});

/* ---------------------- Student Schema ---------------------- */

const StudentSchema = new Schema<IStudent>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    headline: String,
    location: { type: String, required: true },
    about: String,
    profile_image: String,
    preferred_field: { type: String },

    department: { type: String, trim: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    batch_year: { type: Number, min: 1990, max: 2100, index: true },
    cgpa: { type: Number, min: 0, max: 10 },
    backlogs: { type: Number, min: 0, default: 0 },

    placement_intent: {
      type: String,
      enum: PLACEMENT_INTENTS,
      default: 'placement',
      index: true,
    },
    opted_out_reason: { type: String },

    aptitude_score: { type: Number, min: 0, max: 100 },
    mock_interviews: { type: Number, min: 0, default: 0 },
    mock_interview_score: { type: Number, min: 0, max: 10 },
    training_attendance: { type: Number, min: 0, max: 100 },
    resume_verified: { type: Boolean, default: false },

    linkedin_url: String,
    github_url: String,
    resume_link: String,

    looking_for: {
      type: LookingForSchema,
      default: {},
    },

    experience: { type: [ExperienceSchema], default: [] },
    total_experience: { type: Number, default: 0 },

    projects: { type: [ProjectSchema], default: [] },
    certificates: { type: [CertificateSchema], default: [] },

    skills: [{ type: Schema.Types.ObjectId, ref: 'Skill', default: [] }],
    education: { type: [EducationSchema], default: [] },
  },
  { timestamps: true }
);

/* ---------------------- Experience Auto Calculation ---------------------- */

function calculateTotalExperience(experiences?: IExperience[]): number {
  if (!experiences || experiences.length === 0) return 0;

  let totalMonths = 0;

  experiences.forEach((exp) => {
    const start = new Date(exp.start_date);
    const end = exp.end_date ? new Date(exp.end_date) : new Date();

    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

    if (months > 0) totalMonths += months;
  });

  return totalMonths;
}

// Pre-save hook
StudentSchema.pre('save', function (next) {
  this.total_experience = calculateTotalExperience(this.experience);
  next();
});

// Pre-update hook
StudentSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;

  if (update.experience) {
    update.total_experience = calculateTotalExperience(update.experience);
  }

  next();
});

/* ---------------------- Model Export ---------------------- */

const Student = mongoose.model<IStudent>('Student', StudentSchema);
export { Student };
export type { IStudent };
