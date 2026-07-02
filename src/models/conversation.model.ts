import mongoose, { Document, Schema, Types } from 'mongoose';

interface IConversation extends Document {
  participants: Types.ObjectId[];
  is_group: boolean;
  participants_key?: string; // sorted participant ids joined by '_' (1:1 dedup)
  last_message?: { text: string; sender: Types.ObjectId; sent_at: Date };
  last_activity: Date;
  unread: { user: Types.ObjectId; count: number }[];
  created_by: Types.ObjectId;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    is_group: { type: Boolean, default: false },
    participants_key: { type: String, unique: true, sparse: true },
    last_message: {
      text: String,
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      sent_at: Date,
    },
    last_activity: { type: Date, default: Date.now, index: true },
    unread: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        count: { type: Number, default: 0 },
      },
    ],
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1 });

const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);

export { Conversation };
export type { IConversation };
