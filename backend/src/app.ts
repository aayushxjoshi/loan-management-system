import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { createRouter } from "./routes";
import { buildContainer, Container } from "./container";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp(container: Container = buildContainer()) {
  const app = express();
  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json());
  app.use("/api", createRouter(container));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
