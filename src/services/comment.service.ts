import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { Reaction } from '../models/reaction.model';
import { ApiError } from '../utils/ApiError';
import { notificationService } from './notification.service';

interface Actor {
  _id: any;
  roles: string[];
}

const AUTHOR_FIELDS = 'firstName lastName roles';

export class CommentService {
  async create(postId: string, authorId: string, data: { content: string; parent?: string; mentions?: string[] }) {
    if (!data.content?.trim()) throw new ApiError(400, 'Comment content is required.');
    const post = await Post.findById(postId);
    if (!post) throw new ApiError(404, 'Post not found.');

    let parentAuthor: any = null;
    if (data.parent) {
      const parent = await Comment.findById(data.parent);
      if (!parent || String(parent.post) !== String(postId)) {
        throw new ApiError(400, 'Invalid parent comment.');
      }
      parentAuthor = parent.author;
      // Only one level of nesting — reply to a reply attaches to its root.
      if (parent.parent) data.parent = String(parent.parent);
    }

    const comment = await Comment.create({
      post: postId,
      author: authorId,
      content: data.content,
      parent: data.parent || null,
      mentions: data.mentions || [],
    });
    await Post.updateOne({ _id: postId }, { $inc: { comment_count: 1 } });

    // Notifications: reply → parent author; otherwise → post author; plus mentions.
    if (parentAuthor) {
      await notificationService.create({
        recipient: parentAuthor,
        actor: authorId,
        type: 'reply',
        entity: { kind: 'post', id: postId },
        text: 'replied to your comment',
      });
    } else {
      await notificationService.create({
        recipient: post.author,
        actor: authorId,
        type: 'comment',
        entity: { kind: 'post', id: postId },
        text: 'commented on your post',
      });
    }
    if (data.mentions?.length) {
      await notificationService.createMany(data.mentions, {
        actor: authorId,
        type: 'mention',
        entity: { kind: 'post', id: postId },
        text: 'mentioned you in a comment',
      });
    }

    return comment.populate([
      { path: 'author', select: AUTHOR_FIELDS },
      { path: 'mentions', select: AUTHOR_FIELDS },
    ]);
  }

  async list(postId: string, viewerId?: string) {
    const comments = await Comment.find({ post: postId })
      .populate('author', AUTHOR_FIELDS)
      .populate('mentions', AUTHOR_FIELDS)
      .sort({ createdAt: 1 });

    // Drop comments whose author was deleted (orphaned populate → null).
    const plain = comments.map((c) => c.toObject()).filter((c: any) => c.author);
    if (!viewerId) return plain.map((c) => ({ ...c, my_reaction: null }));

    const reactions = await Reaction.find({
      target_type: 'comment',
      target: { $in: plain.map((c) => c._id) },
      user: viewerId,
    });
    const mine = new Map(reactions.map((r) => [String(r.target), r.type]));
    return plain.map((c) => ({ ...c, my_reaction: mine.get(String(c._id)) || null }));
  }

  async remove(id: string, actor: Actor) {
    const comment = await Comment.findById(id);
    if (!comment) throw new ApiError(404, 'Comment not found.');

    // Deletable by: the comment author, the owner of the post it's on, or an admin.
    const post = await Post.findById(comment.post).select('author');
    const isCommentAuthor = String(comment.author) === String(actor._id);
    const isPostOwner = !!post && String(post.author) === String(actor._id);
    if (!isCommentAuthor && !isPostOwner && !actor.roles.includes('admin')) {
      throw new ApiError(403, 'You can only delete your own comments or comments on your post.');
    }

    // Delete this comment and any replies to it, plus their reactions.
    const replies = await Comment.find({ parent: id }).select('_id');
    const replyIds = replies.map((r) => r._id);
    const removedCount = 1 + replyIds.length;

    await Promise.all([
      Comment.deleteMany({ _id: { $in: [id, ...replyIds] } }),
      Reaction.deleteMany({ target_type: 'comment', target: { $in: [comment._id, ...replyIds] } }),
    ]);
    await Post.updateOne({ _id: comment.post }, { $inc: { comment_count: -removedCount } });

    return { _id: id, removed: removedCount };
  }
}
