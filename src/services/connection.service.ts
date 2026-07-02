import { Connection, pairKey } from '../models/connection.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { notificationService } from './notification.service';

const USER_FIELDS = 'firstName lastName roles';

export class ConnectionService {
  async request(meId: string, otherId: string) {
    if (String(meId) === String(otherId)) throw new ApiError(400, 'You cannot connect with yourself.');
    const other = await User.findById(otherId);
    if (!other) throw new ApiError(404, 'User not found.');

    const key = pairKey(meId, otherId);
    const existing = await Connection.findOne({ pair_key: key });
    if (existing) {
      throw new ApiError(409, existing.status === 'accepted' ? 'You are already connected.' : 'A connection request already exists.');
    }

    const conn = await Connection.create({ requester: meId, recipient: otherId, status: 'pending', pair_key: key });
    await notificationService.create({
      recipient: otherId,
      actor: meId,
      type: 'connection_request',
      entity: { kind: 'user', id: meId },
      text: 'sent you a connection request',
    });
    return conn;
  }

  async respond(meId: string, connectionId: string, accept: boolean) {
    const conn = await Connection.findById(connectionId);
    if (!conn) throw new ApiError(404, 'Request not found.');
    if (String(conn.recipient) !== String(meId)) throw new ApiError(403, 'This request is not addressed to you.');
    if (conn.status !== 'pending') throw new ApiError(400, 'This request is no longer pending.');

    if (!accept) {
      await conn.deleteOne();
      return { _id: connectionId, status: 'rejected' };
    }

    conn.status = 'accepted';
    await conn.save();
    await notificationService.create({
      recipient: conn.requester,
      actor: meId,
      type: 'connection_accepted',
      entity: { kind: 'user', id: meId },
      text: 'accepted your connection request',
    });
    return conn;
  }

  /** Withdraw a pending request or disconnect an accepted connection. */
  async remove(meId: string, otherId: string) {
    const key = pairKey(meId, otherId);
    const conn = await Connection.findOne({ pair_key: key });
    if (!conn) throw new ApiError(404, 'No connection found.');
    if (String(conn.requester) !== String(meId) && String(conn.recipient) !== String(meId)) {
      throw new ApiError(403, 'Not your connection.');
    }
    await conn.deleteOne();
    return { removed: true };
  }

  async listConnections(meId: string) {
    const conns = await Connection.find({ status: 'accepted', $or: [{ requester: meId }, { recipient: meId }] })
      .populate('requester', USER_FIELDS)
      .populate('recipient', USER_FIELDS)
      .sort({ updatedAt: -1 });
    return conns.map((c: any) => {
      const other = String(c.requester._id) === String(meId) ? c.recipient : c.requester;
      return { connectionId: c._id, user: other, since: c.updatedAt };
    });
  }

  async listPending(meId: string) {
    const [incoming, outgoing] = await Promise.all([
      Connection.find({ recipient: meId, status: 'pending' }).populate('requester', USER_FIELDS).sort({ createdAt: -1 }),
      Connection.find({ requester: meId, status: 'pending' }).populate('recipient', USER_FIELDS).sort({ createdAt: -1 }),
    ]);
    return {
      incoming: incoming.map((c: any) => ({ connectionId: c._id, user: c.requester, createdAt: c.createdAt })),
      outgoing: outgoing.map((c: any) => ({ connectionId: c._id, user: c.recipient, createdAt: c.createdAt })),
    };
  }

  /** Relationship of `meId` toward `otherId`. */
  async statusWith(meId: string, otherId: string) {
    if (String(meId) === String(otherId)) return { status: 'self' as const };
    const conn = await Connection.findOne({ pair_key: pairKey(meId, otherId) });
    if (!conn) return { status: 'none' as const };
    if (conn.status === 'accepted') return { status: 'connected' as const, connectionId: conn._id };
    return {
      status: String(conn.requester) === String(meId) ? ('outgoing' as const) : ('incoming' as const),
      connectionId: conn._id,
    };
  }
}
