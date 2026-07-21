import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A placement outcome for a student — the record the TPC actually reports on.
 *
 * One student may hold several (an internship in year 3, a PPO converted from it,
 * an off-campus job offer). Dashboard "placed" counts use status in
 * ACCEPTED_STATUSES so a declined offer never inflates the numbers.
 */

export type PlacementType = 'internship' | 'job' | 'ppo';
export type PlacementStatus = 'offered' | 'accepted' | 'joined' | 'completed' | 'declined';

/** Statuses that count a student as actually placed. */
export const ACCEPTED_STATUSES: PlacementStatus[] = ['accepted', 'joined', 'completed'];

interface IPlacement extends Document {
  student: Types.ObjectId; // User
  opening?: Types.ObjectId;
  application?: Types.ObjectId;

  company: string;
  role: string;
  type: PlacementType;
  source: 'campus' | 'off_campus';

  location?: string;
  sector?: string; // industry — drives the diversification chart
  ctc_lpa?: number; // annual package in LPA — jobs / PPOs
  stipend?: number; // monthly stipend — internships

  offer_date?: Date;
  start_date?: Date;
  end_date?: Date; // internships

  status: PlacementStatus;
  notes?: string;
}

const PlacementSchema = new Schema<IPlacement>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opening: { type: Schema.Types.ObjectId, ref: 'Opening' },
    application: { type: Schema.Types.ObjectId, ref: 'Application' },

    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    type: { type: String, enum: ['internship', 'job', 'ppo'], required: true, index: true },
    source: { type: String, enum: ['campus', 'off_campus'], default: 'campus' },

    location: { type: String, trim: true },
    sector: { type: String, trim: true, index: true },
    ctc_lpa: { type: Number, min: 0 },
    stipend: { type: Number, min: 0 },

    offer_date: { type: Date },
    start_date: { type: Date },
    end_date: { type: Date },

    status: {
      type: String,
      enum: ['offered', 'accepted', 'joined', 'completed', 'declined'],
      default: 'offered',
      index: true,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

// Dashboard aggregations group by (type, status) and scan recent offers.
PlacementSchema.index({ type: 1, status: 1 });
PlacementSchema.index({ student: 1, status: 1 });
PlacementSchema.index({ offer_date: -1 });

const Placement = mongoose.model<IPlacement>('Placement', PlacementSchema);

export { Placement };
export type { IPlacement };
