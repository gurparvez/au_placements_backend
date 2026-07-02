import mongoose, { Document, Schema, Types } from 'mongoose';

interface IMessage extends Document {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  read_by: Types.ObjectId[];
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    read_by: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

MessageSchema.index({ conversation: 1, createdAt: 1 });

const Message = mongoose.model<IMessage>('Message', MessageSchema);

export { Message };
export type { IMessage };
