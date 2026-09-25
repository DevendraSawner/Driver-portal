import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { sendError } from "../utils/api-response.js";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    sendError(res, error.statusCode, error.message, error.errors);
    return;
  }

  if (error instanceof ZodError) {
    sendError(
      res,
      400,
      "Validation failed",
      error.issues.map((issue) => ({
        field: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "value";
    sendError(res, 409, `An account with this ${String(target)} already exists`);
    return;
  }

  console.error(
    JSON.stringify({
      requestId: req.requestId,
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );

  const message = env.NODE_ENV === "production" ? "Internal server error" : "Internal server error";
  sendError(res, 500, message);
}
