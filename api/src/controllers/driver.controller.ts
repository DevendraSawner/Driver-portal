import type { Request, Response } from "express";
import {
  getDriverKyc,
  getDriverKycStatus,
  getDriverProfile,
  submitKyc,
  updateDriverProfile,
} from "../services/driver.service.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

function requireUserId(req: Request): string {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  return req.authUser.id;
}

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await getDriverProfile(requireUserId(req)));
});

export const patchProfile = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Driver profile updated", await updateDriverProfile(requireUserId(req), req.body));
});

export const postKyc = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "KYC submitted", await submitKyc(requireUserId(req), req.body), 201);
});

export const getKyc = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await getDriverKyc(requireUserId(req)));
});

export const getKycStatus = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await getDriverKycStatus(requireUserId(req)));
});
