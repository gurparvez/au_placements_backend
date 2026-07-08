import { Conversation } from '../models/conversation.model';
import { Message } from '../models/message.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { notificationService } from './notification.service';
import { emitToUser } from '../config/socket';

const keyFor = (a: string, b: string) => [String(a), String(b)].sort().join('_');
const PARTICIPANT_FIELDS = 'firstName lastName roles';

export class MessageService {
  async getOrCreate(meId: string, otherId: string) {
    if (String(meId) === String(otherId)) throw new ApiError(400, 'You cannot message yourself.');
    const other = await User.findById(otherId);
    if (!other) throw new ApiError(404, 'User not found.');

    const participants_key = keyFor(meId, otherId);
    let convo = await Conversation.findOne({ participants_key });
    if (!convo) {
      convo = await Conversation.create({
        participants: [meId, otherId],
        participants_key,
        created_by: meId,
        last_activity: new Date(),
        unread: [
          { user: meId, count: 0 },
          { user: otherId, count: 0 },
        ],
      });
    }
    return this.shape(await convo.populate('participants', PARTICIPANT_FIELDS), meId);
  }

  private shape(convo: any, meId: string) {
    const other = (convo.participants as any[]).find((p) => String(p._id) !== String(meId)) || null;
    const mine = (convo.unread as any[]).find((u) => String(u.user) === String(meId));
    return {
      _id: convo._id,
      other,
      last_message: convo.last_message,
      last_activity: convo.last_activity,
      unread: mine ? mine.count : 0,
    };
  }

  async listConversations(meId: string) {
    const convos = await Conversation.find({ participants: meId })
      .populate('participants', PARTICIPANT_FIELDS)
      .sort({ last_activity: -1 });
    return convos.map((c) => this.shape(c, meId));
  }

  private async ensureMember(convoId: string, meId: string) {
    const convo = await Conversation.findById(convoId);
    if (!convo) throw new ApiError(404, 'Conversation not found.');
    if (!convo.participants.some((p) => String(p) === String(meId))) {
      throw new ApiError(403, 'You are not part of this conversation.');
    }
    return convo;
  }

  async listMessages(convoId: string, meId: string) {
    const convo = await this.ensureMember(convoId, meId);

    const messages = await Message.find({ conversation: convoId })
      .populate('sender', PARTICIPANT_FIELDS)
      .sort({ createdAt: 1 })
      .limit(200);

    // Mark read: reset my unread + record me as reader on others' messages.
    await Promise.all([
      Conversation.updateOne({ _id: convoId, 'unread.user': meId }, { $set: { 'unread.$.count': 0 } }),
      Message.updateMany({ conversation: convoId, sender: { $ne: meId }, read_by: { $ne: meId } }, { $addToSet: { read_by: meId } }),
    ]);

    await convo.populate('participants', PARTICIPANT_FIELDS);
    return { conversation: this.shape(convo, meId), messages };
  }

  async send(convoId: string, meId: string, content: string) {
    if (!content?.trim()) throw new ApiError(400, 'Message content is required.');
    const convo = await this.ensureMember(convoId, meId);
    const other = convo.participants.find((p) => String(p) !== String(meId));

    const message = await Message.create({ conversation: convoId, sender: meId, content, read_by: [meId] });

    await Conversation.updateOne(
      { _id: convoId },
      {
        $set: { last_message: { text: content, sender: meId, sent_at: new Date() }, last_activity: new Date() },
        $inc: { 'unread.$[o].count': 1 },
      },
      { arrayFilters: [{ 'o.user': other }] }
    );

    const populated = await message.populate('sender', PARTICIPANT_FIELDS);

    if (other) {
      // Deliver the message live to the recipient's open chat / inbox.
      emitToUser(other, 'message:new', { conversationId: String(convoId), message: populated });
      await notificationService.create({
        recipient: other,
        actor: meId,
        type: 'message',
        entity: { kind: 'message', id: convoId },
        text: 'sent you a message',
      });
    }

    return populated;
  }
}
