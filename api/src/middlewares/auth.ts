import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const payload = verifyAccessToken(header.slice("Bearer ".length).trim());
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || user.deletedAt) {
      throw new AppError(401, "Authentication required");
    }

    if (user.status !== "ACTIVE") {
      throw new AppError(403, "This account cannot access the platform");
    }

    if (user.role !== payload.role) {
      throw new AppError(401, "Authentication required");
    }

    req.authUser = {
      id: user.id,
      role: user.role,
      status: "ACTIVE",
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      sessionId: payload.sid,
    };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(401, "Authentication required"));
  }
}
