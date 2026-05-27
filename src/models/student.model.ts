import mongoose, { Document, Schema, Types } from 'mongoose';

/* ---------------------- Interfaces ---------------------- */

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

interface IAcademicRecord {
  semester: number;
  academic_year?: string;
  cgpa?: number;
  marks_percentage?: number;
  backlog_count?: number;
  updated_at?: Date;
}

interface IProfileLink {
  label: string;
  url: string;
}

interface IProfileNote {
  title: string;
  description?: string;
  date?: Date;
}

interface ISupportingDocument {
  name: string;
  url: string;
  mime_type: string;
  uploaded_at: Date;
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
  institute: string;
  from_date: Date;
  to_date: Date;
  course: Types.ObjectId;
  specialization?: string;
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
  links?: IProfileLink[];
  supporting_documents?: ISupportingDocument[];

  preferred_field?: string;

  looking_for: ILookingFor;

  academic_records?: IAcademicRecord[];
  cgpa_current?: number;
  experience?: IExperience[];
  total_experience: number;

  projects?: IProject[];
  certificates?: ICertificate[];
  achievements?: IProfileNote[];
  extracurricular_activities?: IProfileNote[];

  skills?: Types.ObjectId[];
  education?: IEducation[];
  profile_completion: number;
  profile_version: number;
  last_profile_reviewed_at?: Date;
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

const AcademicRecordSchema = new Schema<IAcademicRecord>({
  semester: { type: Number, required: true, min: 1, max: 16 },
  academic_year: { type: String },
  cgpa: { type: Number, min: 0, max: 10 },
  marks_percentage: { type: Number, min: 0, max: 100 },
  backlog_count: { type: Number, min: 0, default: 0 },
  updated_at: { type: Date, default: Date.now },
});

const ProfileLinkSchema = new Schema<IProfileLink>({
  label: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
});

const ProfileNoteSchema = new Schema<IProfileNote>({
  title: { type: String, required: true, trim: true },
  description: { type: String },
  date: { type: Date },
});

const SupportingDocumentSchema = new Schema<ISupportingDocument>({
  name: { type: String, required: true },
  url: { type: String, required: true },
  mime_type: { type: String, required: true },
  uploaded_at: { type: Date, default: Date.now },
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
  institute: { type: String, required: true },
  from_date: { type: Date, required: true },
  to_date: { type: Date, required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  specialization: { type: String },
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

    linkedin_url: String,
    github_url: String,
    resume_link: String,
    links: { type: [ProfileLinkSchema], default: [] },
    supporting_documents: { type: [SupportingDocumentSchema], default: [] },

    looking_for: {
      type: LookingForSchema,
      default: {},
    },

    academic_records: { type: [AcademicRecordSchema], default: [] },
    cgpa_current: { type: Number, min: 0, max: 10 },

    experience: { type: [ExperienceSchema], default: [] },
    total_experience: { type: Number, default: 0 },

    projects: { type: [ProjectSchema], default: [] },
    certificates: { type: [CertificateSchema], default: [] },
    achievements: { type: [ProfileNoteSchema], default: [] },
    extracurricular_activities: { type: [ProfileNoteSchema], default: [] },

    skills: [{ type: Schema.Types.ObjectId, ref: 'Skill', default: [] }],
    education: { type: [EducationSchema], default: [] },
    profile_completion: { type: Number, default: 0, min: 0, max: 100 },
    profile_version: { type: Number, default: 1 },
    last_profile_reviewed_at: { type: Date },
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

function calculateCurrentCgpa(records?: IAcademicRecord[]): number | undefined {
  const recordsWithCgpa = (records || [])
    .filter((record) => typeof record.cgpa === 'number')
    .sort((a, b) => b.semester - a.semester);

  return recordsWithCgpa[0]?.cgpa;
}

function hasItems(value?: unknown[]) {
  return Array.isArray(value) && value.length > 0;
}

function calculateProfileCompletion(profile: Partial<IStudent>): number {
  const checks = [
    Boolean(profile.headline),
    Boolean(profile.location),
    Boolean(profile.about),
    Boolean(profile.profile_image),
    Boolean(profile.resume_link),
    Boolean(profile.linkedin_url || profile.github_url || hasItems(profile.links)),
    Boolean(profile.looking_for?.type && profile.looking_for?.from_date),
    hasItems(profile.education),
    hasItems(profile.academic_records),
    hasItems(profile.skills),
    hasItems(profile.projects),
    hasItems(profile.certificates),
    hasItems(profile.experience),
    hasItems(profile.achievements),
    hasItems(profile.extracurricular_activities),
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

// Pre-save hook
StudentSchema.pre('save', function (next) {
  this.total_experience = calculateTotalExperience(this.experience);
  this.cgpa_current = calculateCurrentCgpa(this.academic_records);
  this.profile_completion = calculateProfileCompletion(this);
  next();
});

// Pre-update hook
StudentSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;

  if (update.$set?.experience) {
    update.$set.total_experience = calculateTotalExperience(update.$set.experience);
  } else if (update.experience) {
    update.total_experience = calculateTotalExperience(update.experience);
  }

  if (update.$set?.academic_records) {
    update.$set.cgpa_current = calculateCurrentCgpa(update.$set.academic_records);
  } else if (update.academic_records) {
    update.cgpa_current = calculateCurrentCgpa(update.academic_records);
  }

  next();
});

/* ---------------------- Model Export ---------------------- */

const Student = mongoose.model<IStudent>('Student', StudentSchema);
export { Student, calculateCurrentCgpa, calculateProfileCompletion, calculateTotalExperience };
export type { IStudent, ISupportingDocument };
