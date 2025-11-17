import express from "express";
import routes from "./routes";
import dotenv from "dotenv";

dotenv.config();

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", routes);

  return app;
}
