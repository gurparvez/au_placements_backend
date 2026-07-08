import type { Server as HttpServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { CONFIG } from './environment';
import { redis } from './redis';

let io: IOServer | null = null;

function parseCookie(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  raw.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

export function initSocket(httpServer: HttpServer) {
  io = new IOServer(httpServer, {
    path: '/socket.io',
    cors: { origin: CONFIG.corsOrigins, credentials: true },
  });

  // Horizontal scale: fan out emits across instances via Redis pub/sub.
  // Without Redis this stays a single-instance in-memory adapter (dev).
  if (redis) {
    io.adapter(createAdapter(redis.duplicate(), redis.duplicate()));
    console.log('🔌 Socket.IO using Redis adapter (multi-instance ready)');
  }

  // Authenticate the handshake from the same httpOnly JWT cookie the REST API uses.
  io.use((socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie || '');
      const token = cookies.token || (socket.handshake.auth?.token as string | undefined);
      if (!token) return next(new Error('unauthorized'));
      const decoded = jwt.verify(token, CONFIG.accessTokenSecret) as { _id: string };
      socket.data.userId = String(decoded._id);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId: string = socket.data.userId;
    socket.join(`user:${userId}`); // personal room → target a user on any instance

    // Optional per-conversation rooms (typing indicators, live read receipts…).
    socket.on('conversation:open', (id: string) => id && socket.join(`conv:${id}`));
    socket.on('conversation:close', (id: string) => id && socket.leave(`conv:${id}`));
  });

  return io;
}

/** Emit to all of a user's connected devices, across every instance. No-op if sockets are off. */
export function emitToUser(userId: string | { toString(): string }, event: string, payload: unknown) {
  if (!io) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
}

export function getIO() {
  return io;
}
