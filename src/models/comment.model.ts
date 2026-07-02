import mongoose, { Document, Schema, Types } from 'mongoose';

interface IComment extends Document {
  post: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  mentions: Types.ObjectId[];
  parent?: Types.ObjectId | null; // reply to another comment (one level)
  reaction_count: number;
}

const CommentSchema = new Schema<IComment>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    reaction_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CommentSchema.index({ post: 1, createdAt: 1 });

const Comment = mongoose.model<IComment>('Comment', CommentSchema);

export { Comment };
export type { IComment };
