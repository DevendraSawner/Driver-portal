import type { Request, Response } from "express";
import {
  approveDriver,
  createDriverByAdmin,
  getDriverForAdmin,
  listDrivers,
  rejectDriver,
  suspendDriver,
} from "../services/driver.service.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

function requireAdminId(req: Request): string {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  return req.authUser.id;
}

export const getDrivers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as {
    page: number;
    limit: number;
    search?: string;
    kycStatus?: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
    accountStatus?: "PENDING_VERIFICATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED";
  };
  sendSuccess(res, "OK", await listDrivers(query));
});

export const createDriver = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Driver created", await createDriverByAdmin(req.body), 201);
});

export const getDriver = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await getDriverForAdmin(String(req.params.id)));
});

export const postApproveDriver = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Driver approved", await approveDriver(String(req.params.id), requireAdminId(req)));
});

export const postRejectDriver = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Driver rejected", await rejectDriver(String(req.params.id), requireAdminId(req), req.body.reason));
});

export const postSuspendDriver = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Driver suspended", await suspendDriver(String(req.params.id), req.body.reason));
});
