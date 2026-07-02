import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { Reaction, REACTION_TYPES, ReactionType } from '../models/reaction.model';
import { ApiError } from '../utils/ApiError';
import { notificationService } from './notification.service';

export class ReactionService {
  /**
   * Toggle a reaction on a post or comment:
   *  - no existing reaction  → add `type`
   *  - same type again       → remove (un-react)
   *  - different type        → switch to `type`
   * Recomputes and denormalizes the total reaction_count onto the target.
   */
  async toggle(targetType: 'post' | 'comment', targetId: string, userId: string, type: ReactionType) {
    if (!REACTION_TYPES.includes(type)) throw new ApiError(400, 'Invalid reaction type.');

    const Model: any = targetType === 'post' ? Post : Comment;
    const target = await Model.findById(targetId);
    if (!target) throw new ApiError(404, `${targetType} not found.`);

    const existing = await Reaction.findOne({ target_type: targetType, target: targetId, user: userId });

    let myReaction: ReactionType | null;
    if (existing) {
      if (existing.type === type) {
        await existing.deleteOne();
        myReaction = null;
      } else {
        existing.type = type;
        await existing.save();
        myReaction = type;
      }
    } else {
      await Reaction.create({ target_type: targetType, target: targetId, user: userId, type });
      myReaction = type;
      // Notify the author only on a brand-new reaction (not toggles/switches).
      const postId = targetType === 'post' ? target._id : target.post;
      await notificationService.create({
        recipient: target.author,
        actor: userId,
        type: 'reaction',
        entity: { kind: 'post', id: postId },
        text: targetType === 'post' ? 'reacted to your post' : 'reacted to your comment',
      });
    }

    const count = await Reaction.countDocuments({ target_type: targetType, target: targetId });
    await Model.updateOne({ _id: targetId }, { $set: { reaction_count: count } });

    return { my_reaction: myReaction, reaction_count: count };
  }
}
