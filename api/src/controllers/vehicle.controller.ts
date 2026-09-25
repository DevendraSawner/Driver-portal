import type { Request, Response } from "express";
import { createVehicle, deleteVehicle, getVehicle, listVehicles, updateVehicle } from "../services/vehicle.service.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

function requireUserId(req: Request): string {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  return req.authUser.id;
}

export const postVehicle = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Vehicle added", await createVehicle(requireUserId(req), req.body), 201);
});

export const getVehicles = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await listVehicles(requireUserId(req)));
});

export const getVehicleById = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await getVehicle(requireUserId(req), String(req.params.id)));
});

export const patchVehicle = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Vehicle updated", await updateVehicle(requireUserId(req), String(req.params.id), req.body));
});

export const removeVehicle = asyncHandler(async (req: Request, res: Response) => {
  await deleteVehicle(requireUserId(req), String(req.params.id));
  sendSuccess(res, "Vehicle removed", {});
});
