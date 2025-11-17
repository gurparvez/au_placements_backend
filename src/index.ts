import { createServer } from "./server";
import { connectDB } from "./config/database";
import { CONFIG } from "./config/environment";

const port = CONFIG.port;

async function bootstrap() {
  try {
    await connectDB();

    const app = createServer();

    app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

bootstrap();
