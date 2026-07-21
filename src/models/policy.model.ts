import mongoose, { Document, Schema } from 'mongoose';

/**
 * Placement policy — a single settings document the TPO edits.
 *
 * This is the main lever for *optimising* the placement percentage: without an
 * offer lock, strong students accumulate several offers each while the tail of
 * the batch goes unplaced. Tiering keeps the lock fair — a student locked by a
 * modest offer may still sit for a dream company.
 */
interface IPlacementPolicy extends Document {
  key: 'default'; // singleton

  /** Lock a student out of further drives once they hold an accepted offer. */
  one_offer_lock: boolean;
  /** A regular-tier offer still allows sitting for core/dream companies. */
  allow_upgrade_to_higher_tier: boolean;
  /** CTC (LPA) at or above which an opening counts as 'dream'. */
  dream_ctc_threshold: number;
  /** Hard cap on offers per student (0 ⇒ unlimited). */
  max_offers_per_student: number;

  /** Default eligibility floor applied when an opening sets none. */
  default_min_cgpa: number;
  default_max_backlogs: number;

  /** Academic session start month (0-indexed) — July for Indian universities. */
  session_start_month: number;
}

const PlacementPolicySchema = new Schema<IPlacementPolicy>(
  {
    key: { type: String, default: 'default', unique: true, immutable: true },

    one_offer_lock: { type: Boolean, default: true },
    allow_upgrade_to_higher_tier: { type: Boolean, default: true },
    dream_ctc_threshold: { type: Number, default: 12, min: 0 },
    max_offers_per_student: { type: Number, default: 0, min: 0 },

    default_min_cgpa: { type: Number, default: 0, min: 0, max: 10 },
    default_max_backlogs: { type: Number, default: 99, min: 0 },

    session_start_month: { type: Number, default: 6, min: 0, max: 11 },
  },
  { timestamps: true }
);

const PlacementPolicy = mongoose.model<IPlacementPolicy>('PlacementPolicy', PlacementPolicySchema);

/** Fetch the singleton, creating it with defaults on first use. */
export async function getPolicy() {
  const existing = await PlacementPolicy.findOne({ key: 'default' }).lean();
  if (existing) return existing as unknown as IPlacementPolicy;
  const created = await PlacementPolicy.create({ key: 'default' });
  return created.toObject() as unknown as IPlacementPolicy;
}

export { PlacementPolicy };
export type { IPlacementPolicy };
