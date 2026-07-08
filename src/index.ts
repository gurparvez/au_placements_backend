import { connectDB, disconnectDB } from './config/database';
import { CONFIG } from './config/environment';
import { closeRedis } from './config/redis';
import { initSocket } from './config/socket';
import { createServer } from './server';

const port = CONFIG.port;

async function bootstrap() {
  try {
    await connectDB();

    const app = createServer();

    const server = app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
    });

    // Real-time layer (notifications + messages) attached to the same HTTP server.
    initSocket(server);

    // Graceful shutdown: stop accepting new connections, drain, close resources.
    const shutdown = (signal: string) => {
      console.log(`\n${signal} received — shutting down gracefully…`);
      server.close(async () => {
        await Promise.allSettled([disconnectDB(), closeRedis()]);
        process.exit(0);
      });
      // Hard-exit backstop if connections don't drain in time.
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
