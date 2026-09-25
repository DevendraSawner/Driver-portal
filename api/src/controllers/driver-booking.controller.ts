import type { Request, Response } from "express";
import {
  acceptBooking,
  cancelBookingByDriver,
  listDriverRequests,
  markArrived,
  markEnRoute,
  rejectBooking,
} from "../services/booking.service.js";
import { setDriverAvailability } from "../services/driver.service.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

function driverId(req: Request): string {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  return req.authUser.id;
}

export const getRequests = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await listDriverRequests(driverId(req)));
});

export const postAccept = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Booking accepted", await acceptBooking(driverId(req), String(req.params.id)));
});

export const postReject = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Booking rejected", await rejectBooking(driverId(req), String(req.params.id), req.body.reason));
});

export const postEnRoute = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Driver is on the way", await markEnRoute(driverId(req), String(req.params.id)));
});

export const postArrived = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Arrival recorded", await markArrived(driverId(req), String(req.params.id)));
});

export const postDriverCancel = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Booking cancelled", await cancelBookingByDriver(driverId(req), String(req.params.id), req.body.reason));
});

export const postAvailability = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Availability updated", await setDriverAvailability(driverId(req), req.body.online));
});
