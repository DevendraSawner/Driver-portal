import type { Request, Response } from "express";
import { getCurrentUser, updateCurrentUser } from "../services/user.service.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

function requireUserId(req: Request): string {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  return req.authUser.id;
}

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await getCurrentUser(requireUserId(req));
  sendSuccess(res, "OK", user);
});

export const patchMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateCurrentUser(requireUserId(req), req.body);
  sendSuccess(res, "Profile updated", user);
});
