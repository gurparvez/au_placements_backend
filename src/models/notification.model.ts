import mongoose, { Document, Schema, Types } from 'mongoose';

export type NotificationType =
  | 'reaction'
  | 'comment'
  | 'reply'
  | 'mention'
  | 'message'
  | 'recruiter_approved'
  | 'recruiter_rejected'
  | 'connection_request'
  | 'connection_accepted'
  | 'follow'
  | 'application';

interface INotification extends Document {
  recipient: Types.ObjectId;
  actor?: Types.ObjectId;
  type: NotificationType;
  entity?: { kind: 'post' | 'comment' | 'message' | 'opening' | 'user'; id: Types.ObjectId };
  text?: string;
  read: boolean;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: [
        'reaction', 'comment', 'reply', 'mention', 'message',
        'recruiter_approved', 'recruiter_rejected',
        'connection_request', 'connection_accepted', 'follow', 'application',
      ],
      required: true,
    },
    entity: {
      kind: { type: String, enum: ['post', 'comment', 'message', 'opening', 'user'] },
      id: { type: Schema.Types.ObjectId },
    },
    text: { type: String },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

export { Notification };
export type { INotification };
