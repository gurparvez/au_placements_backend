import mongoose, { Document, Schema, Types } from 'mongoose';

export const REACTION_TYPES = ['like', 'celebrate', 'support', 'insightful', 'funny', 'love'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

interface IReaction extends Document {
  target_type: 'post' | 'comment';
  target: Types.ObjectId;
  user: Types.ObjectId;
  type: ReactionType;
}

const ReactionSchema = new Schema<IReaction>(
  {
    target_type: { type: String, enum: ['post', 'comment'], required: true },
    target: { type: Schema.Types.ObjectId, required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: REACTION_TYPES, required: true },
  },
  { timestamps: true }
);

// One reaction per user per target.
ReactionSchema.index({ target_type: 1, target: 1, user: 1 }, { unique: true });

const Reaction = mongoose.model<IReaction>('Reaction', ReactionSchema);

export { Reaction };
export type { IReaction };
