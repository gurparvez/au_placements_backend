import mongoose, { Document, Schema, Types } from 'mongoose';

interface IConnection extends Document {
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  status: 'pending' | 'accepted';
  pair_key: string; // sorted user ids joined by '_' — prevents duplicate/reverse requests
}

const ConnectionSchema = new Schema<IConnection>(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    pair_key: { type: String, unique: true },
  },
  { timestamps: true }
);

const Connection = mongoose.model<IConnection>('Connection', ConnectionSchema);

export const pairKey = (a: string, b: string) => [String(a), String(b)].sort().join('_');

export { Connection };
export type { IConnection };
