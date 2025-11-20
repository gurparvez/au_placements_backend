import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import routes from './routes';
import cookieParser from "cookie-parser";

dotenv.config();

export function createServer() {
  const app = express();

  app.use(
    cors({
      origin: [
        "http://localhost:3000",          // React local
        "http://localhost:5173",          // Vite
        "http://localhost:8000",          // Postman
        "https://your-frontend.vercel.app" // Production frontend
      ],
      credentials: true,
    })
  );

  app.use(cookieParser());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', routes);

  return app;
}
