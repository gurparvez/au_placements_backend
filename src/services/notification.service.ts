import { Notification, NotificationType } from '../models/notification.model';

interface CreateInput {
  recipient: any;
  actor?: any;
  type: NotificationType;
  entity?: { kind: 'post' | 'comment' | 'message' | 'opening' | 'user'; id: any };
  text?: string;
}

export class NotificationService {
  /** Fire-and-forget notification creation; never notifies the actor about themselves. */
  async create(input: CreateInput) {
    if (input.actor && String(input.actor) === String(input.recipient)) return;
    try {
      await Notification.create({
        recipient: input.recipient,
        actor: input.actor,
        type: input.type,
        entity: input.entity,
        text: input.text,
      });
    } catch (err) {
      console.error('[notification] create failed:', err);
    }
  }

  async createMany(recipients: any[], input: Omit<CreateInput, 'recipient'>) {
    const unique = Array.from(new Set(recipients.map((r) => String(r))));
    await Promise.all(unique.map((recipient) => this.create({ ...input, recipient })));
  }

  async list(userId: string, page: number, limit: number, skip: number) {
    const [items, total, unread] = await Promise.all([
      Notification.find({ recipient: userId })
        .populate('actor', 'firstName lastName roles')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ recipient: userId }),
      Notification.countDocuments({ recipient: userId, read: false }),
    ]);
    return { items, unread, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async unreadCount(userId: string) {
    return Notification.countDocuments({ recipient: userId, read: false });
  }

  async markRead(userId: string, ids?: string[]) {
    const filter: Record<string, any> = { recipient: userId, read: false };
    if (ids && ids.length) filter._id = { $in: ids };
    await Notification.updateMany(filter, { $set: { read: true } });
    return this.unreadCount(userId);
  }
}

export const notificationService = new NotificationService();
