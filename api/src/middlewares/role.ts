import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      next(new AppError(401, "Authentication required"));
      return;
    }

    if (!roles.includes(req.authUser.role)) {
      next(new AppError(403, "You do not have access to this resource"));
      return;
    }

    next();
  };
}
