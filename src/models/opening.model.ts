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

  /* ---- Eligibility criteria: what the recruiter demands ---- */
  min_cgpa?: number;
  max_backlogs?: number;
  eligible_departments?: string[]; // empty ⇒ all
  eligible_batches?: number[]; // empty ⇒ all
  allow_placed?: boolean; // may already-placed students apply?

  /** Package tier — drives the one-offer policy (see PlacementPolicy). */
  tier?: OpeningTier;
  ctc_lpa?: number; // advertised package, for tier checks and analytics

  /** Selection rounds, in order. Applications track progress through these. */
  rounds?: { name: string; order: number }[];
}

/**
 * Dream/core tiering. A student locked by a 'regular' offer may still sit for
 * 'dream' companies; a 'dream' offer locks them out of everything.
 */
export const OPENING_TIERS = ['regular', 'core', 'dream'] as const;
export type OpeningTier = (typeof OPENING_TIERS)[number];

/** Sensible default pipeline when a recruiter doesn't define one. */
export const DEFAULT_ROUNDS = [
  { name: 'Pre-placement talk', order: 1 },
  { name: 'Aptitude test', order: 2 },
  { name: 'Technical interview', order: 3 },
  { name: 'HR interview', order: 4 },
];

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

    min_cgpa: { type: Number, min: 0, max: 10 },
    max_backlogs: { type: Number, min: 0 },
    eligible_departments: { type: [String], default: [] },
    eligible_batches: { type: [Number], default: [] },
    allow_placed: { type: Boolean, default: false },

    tier: { type: String, enum: OPENING_TIERS, default: 'regular', index: true },
    ctc_lpa: { type: Number, min: 0 },

    rounds: {
      type: [{ name: { type: String, required: true }, order: { type: Number, required: true } }],
      default: () => DEFAULT_ROUNDS,
    },
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
