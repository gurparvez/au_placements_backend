import mongoose, { Document, Schema, Types } from 'mongoose';

interface ILink {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

interface IPost extends Document {
  author: Types.ObjectId;
  content: string;
  links: ILink[];
  mentions: Types.ObjectId[];
  visibility: 'public';
  shared_post?: Types.ObjectId | null;
  archived: boolean;
  reaction_count: number; // total reactions across all types
  comment_count: number;
  share_count: number;
}

const LinkSchema = new Schema<ILink>(
  { url: { type: String, required: true }, title: String, description: String, image: String },
  { _id: false }
);

const PostSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, default: '' }, // optional when the post has media
    links: { type: [LinkSchema], default: [] },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    visibility: { type: String, enum: ['public'], default: 'public' },
    shared_post: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    archived: { type: Boolean, default: false, index: true },
    reaction_count: { type: Number, default: 0 },
    comment_count: { type: Number, default: 0 },
    share_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PostSchema.index({ createdAt: -1 });

const Post = mongoose.model<IPost>('Post', PostSchema);

export { Post };
export type { IPost };
