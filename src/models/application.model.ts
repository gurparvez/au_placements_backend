import mongoose, { Document, Schema, Types } from 'mongoose';

/** A student's application to an opening. One per (opening, student). */
interface IApplication extends Document {
  opening: Types.ObjectId;
  student: Types.ObjectId;   // applicant user
  recruiter: Types.ObjectId; // opening owner, for quick lookups
  status: 'applied' | 'reviewed' | 'shortlisted' | 'interviewed' | 'offered' | 'accepted' | 'rejected';

  /**
   * Progress through the opening's selection rounds. Round-level outcomes are
   * what tell the TPO *where* students fail (aptitude vs technical vs HR) —
   * the flat status alone can't.
   */
  rounds?: { name: string; order: number; result: RoundResult; date?: Date; notes?: string }[];
  current_round?: number; // highest round order reached
}

export const ROUND_RESULTS = ['pending', 'cleared', 'failed', 'absent'] as const;
export type RoundResult = (typeof ROUND_RESULTS)[number];

/** Ordered pipeline stages — the dashboard funnel renders them in this order. */
export const APPLICATION_STAGES = [
  'applied',
  'reviewed',
  'shortlisted',
  'interviewed',
  'offered',
  'accepted',
  'rejected',
] as const;

const ApplicationSchema = new Schema<IApplication>(
  {
    opening: { type: Schema.Types.ObjectId, ref: 'Opening', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: APPLICATION_STAGES, default: 'applied', index: true },

    rounds: {
      type: [{
        name: { type: String, required: true },
        order: { type: Number, required: true },
        result: { type: String, enum: ROUND_RESULTS, default: 'pending' },
        date: { type: Date },
        notes: { type: String },
      }],
      default: [],
    },
    current_round: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// A student can apply to a given opening only once.
ApplicationSchema.index({ opening: 1, student: 1 }, { unique: true });

const Application = mongoose.model<IApplication>('Application', ApplicationSchema);

export { Application };
export type { IApplication };
