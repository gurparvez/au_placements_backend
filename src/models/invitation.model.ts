import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Company outreach tracking. Placement outcomes alone measure the *end* of the
 * pipeline; this measures the front — who the TPC contacted, who replied, who
 * actually visited. Loss between invited and visited is where outreach leaks,
 * and repeat-vs-new recruiter churn is an early warning even while hiring
 * numbers still look healthy.
 */

export const INVITATION_STAGES = ['invited', 'responded', 'declined', 'scheduled', 'visited', 'hired'] as const;
export type InvitationStage = (typeof INVITATION_STAGES)[number];

interface IInvitation extends Document {
  company: string;
  sector?: string;
  contact_name?: string;
  contact_email?: string;
  recruiter?: Types.ObjectId; // linked account, once they have one

  session: number; // academic session year, e.g. 2026 for 2026-27
  stage: InvitationStage;
  is_repeat: boolean; // came in a previous session too

  invited_at?: Date;
  responded_at?: Date;
  visit_date?: Date;
  hires?: number;
  notes?: string;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    company: { type: String, required: true, trim: true, index: true },
    sector: { type: String, trim: true },
    contact_name: { type: String, trim: true },
    contact_email: { type: String, trim: true, lowercase: true },
    recruiter: { type: Schema.Types.ObjectId, ref: 'User' },

    session: { type: Number, required: true, index: true },
    stage: { type: String, enum: INVITATION_STAGES, default: 'invited', index: true },
    is_repeat: { type: Boolean, default: false },

    invited_at: { type: Date, default: Date.now },
    responded_at: { type: Date },
    visit_date: { type: Date },
    hires: { type: Number, min: 0, default: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

// One row per company per session.
InvitationSchema.index({ company: 1, session: 1 }, { unique: true });

const Invitation = mongoose.model<IInvitation>('Invitation', InvitationSchema);

export { Invitation };
export type { IInvitation };
