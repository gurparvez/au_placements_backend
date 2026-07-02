import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { Reaction } from '../models/reaction.model';
import { ApiError } from '../utils/ApiError';
import { notificationService } from './notification.service';

interface Actor {
  _id: any;
  roles: string[];
}

interface PostInput {
  content: string;
  links?: { url: string; title?: string; description?: string; image?: string }[];
  mentions?: string[];
  media?: { type: 'image' | 'video'; url: string; thumbnail?: string }[];
}

const AUTHOR_FIELDS = 'firstName lastName roles';

export class PostService {
  private async attachMyReaction(posts: any[], viewerId?: string) {
    const plain = posts.map((p) => (typeof p.toObject === 'function' ? p.toObject() : p));
    if (!viewerId) return plain.map((p) => ({ ...p, my_reaction: null }));

    const reactions = await Reaction.find({
      target_type: 'post',
      target: { $in: plain.map((p) => p._id) },
      user: viewerId,
    });
    const mine = new Map(reactions.map((r) => [String(r.target), r.type]));
    return plain.map((p) => ({ ...p, my_reaction: mine.get(String(p._id)) || null }));
  }

  private baseQuery(q: any) {
    return q
      .populate('author', AUTHOR_FIELDS)
      .populate('mentions', AUTHOR_FIELDS)
      .populate({ path: 'shared_post', populate: { path: 'author', select: AUTHOR_FIELDS } });
  }

  async create(authorId: string, data: PostInput) {
    if (!data.content?.trim() && !(data.media && data.media.length)) {
      throw new ApiError(400, 'Add some text or an image to post.');
    }
    const post = await Post.create({
      author: authorId,
      content: data.content || '',
      links: data.links || [],
      mentions: data.mentions || [],
      media: data.media || [],
    });

    if (data.mentions?.length) {
      await notificationService.createMany(data.mentions, {
        actor: authorId,
        type: 'mention',
        entity: { kind: 'post', id: post._id },
        text: 'mentioned you in a post',
      });
    }

    return this.getById(String(post._id), authorId);
  }

  async feed(page: number, limit: number, skip: number, viewerId?: string) {
    // Hide archived posts from everyone — except the owner still sees their own.
    const filter: Record<string, any> = viewerId
      ? { $or: [{ archived: { $ne: true } }, { author: viewerId }] }
      : { archived: { $ne: true } };

    const [posts, total] = await Promise.all([
      this.baseQuery(Post.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Post.countDocuments(filter),
    ]);
    const data = await this.attachMyReaction(posts, viewerId);
    return { posts: data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async setArchived(id: string, actor: Actor, archived: boolean) {
    const post = await this.ownedOrThrow(id, actor);
    post.archived = archived;
    await post.save();
    return this.getById(id, String(actor._id));
  }

  async getById(id: string, viewerId?: string) {
    const post = await this.baseQuery(Post.findById(id));
    if (!post) throw new ApiError(404, 'Post not found.');
    const [withMine] = await this.attachMyReaction([post], viewerId);
    return withMine;
  }

  private async ownedOrThrow(id: string, actor: Actor) {
    const post = await Post.findById(id);
    if (!post) throw new ApiError(404, 'Post not found.');
    const isOwner = String(post.author) === String(actor._id);
    if (!isOwner && !actor.roles.includes('admin')) {
      throw new ApiError(403, 'You can only manage your own posts.');
    }
    return post;
  }

  async update(id: string, actor: Actor, data: PostInput) {
    const post = await this.ownedOrThrow(id, actor);
    if (data.content !== undefined) post.content = data.content;
    if (data.links !== undefined) post.links = data.links as any;
    if (data.mentions !== undefined) post.mentions = data.mentions as any;
    await post.save();
    return this.getById(id, String(actor._id));
  }

  async remove(id: string, actor: Actor) {
    const post = await this.ownedOrThrow(id, actor);

    // Remove comments + all reactions tied to the post and its comments.
    const comments = await Comment.find({ post: id }).select('_id');
    const commentIds = comments.map((c) => c._id);
    await Promise.all([
      Comment.deleteMany({ post: id }),
      Reaction.deleteMany({ target_type: 'comment', target: { $in: commentIds } }),
      Reaction.deleteMany({ target_type: 'post', target: id }),
    ]);
    await post.deleteOne();
    return { _id: id };
  }

  async share(id: string, actorId: string, quote?: string) {
    const original = await Post.findById(id);
    if (!original) throw new ApiError(404, 'Post not found.');
    // Share the root post if the target is itself a repost.
    const targetId = original.shared_post ? original.shared_post : original._id;

    const repost = await Post.create({
      author: actorId,
      content: quote || '',
      shared_post: targetId,
    });
    await Post.updateOne({ _id: targetId }, { $inc: { share_count: 1 } });
    return this.getById(String(repost._id), actorId);
  }
}
