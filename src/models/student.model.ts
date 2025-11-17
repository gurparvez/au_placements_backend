import mongoose, { Document, Schema, Types } from 'mongoose'

interface ICertificate {
  name: string
  issued_by: string
  issue_date: Date
  certificate_url: string
  valid_until?: Date
}

interface IExperience {
  company: string
  role: string
  start_date: Date
  end_date?: Date
  description?: string // markdown
}

interface IProject {
  title: string
  start_date: Date
  end_date?: Date
  on_going?: boolean
  tech_used: Types.ObjectId[] // Skill references
  code_url?: string
  live_url?: string
  description?: string
}

interface IEducation {
  institute: string
  from_date: Date
  to_date: Date
  course: Types.ObjectId // reference to Course
  specialization?: string
}

interface IStudent extends Document {
  user: Types.ObjectId

  headline?: string
  location: string
  about?: string

  linkedin_url?: string
  github_url?: string
  resume_link?: string

  experience: IExperience[]
  projects: IProject[]
  certificates: ICertificate[]

  skills: Types.ObjectId[]
  education: IEducation[]
}

const CertificateSchema = new Schema<ICertificate>({
  name: { type: String, required: true },
  issued_by: { type: String, required: true },
  issue_date: { type: Date, required: true },
  certificate_url: { type: String, required: true },
  valid_until: { type: Date },
})

const ExperienceSchema = new Schema<IExperience>({
  company: { type: String, required: true },
  role: { type: String, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date },
  description: { type: String },
})

const ProjectSchema = new Schema<IProject>({
  title: { type: String, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date },
  on_going: { type: Boolean, default: false },
  tech_used: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
  code_url: String,
  live_url: String,
  description: String,
})

const EducationSchema = new Schema<IEducation>({
  institute: { type: String, required: true },
  from_date: { type: Date, required: true },
  to_date: { type: Date, required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  specialization: { type: String },
})

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

    linkedin_url: String,
    github_url: String,
    resume_link: String,

    experience: [ExperienceSchema],
    projects: [ProjectSchema],
    certificates: [CertificateSchema],

    skills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    education: [EducationSchema],
  },
  { timestamps: true }
)

const Student = mongoose.model<IStudent>('Student', StudentSchema)
export { Student }
export type { IStudent }
