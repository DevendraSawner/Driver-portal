import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { sendError, sendSuccess } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    sendSuccess(res, "OK", { database: "up" });
  } catch {
    sendError(res, 503, "Database unavailable");
  }
});
