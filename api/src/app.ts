import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins, env } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { requestContext, requestLogger } from "./middlewares/request-logger.js";
import { apiRouter } from "./modules/index.js";
import { AppError } from "./utils/app-error.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestContext);
  if (env.NODE_ENV !== "test") {
    app.use(requestLogger);
  }

  app.use("/api/v1", apiRouter);

  app.use((_req, _res, next) => {
    next(new AppError(404, "Not found"));
  });
  app.use(errorHandler);

  return app;
}
