import type { Request, Response } from "express";
import {
  cancelBookingByUser,
  createBooking,
  getBooking,
  listBookings,
} from "../services/booking.service.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

function actor(req: Request) {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  return { id: req.authUser.id, role: req.authUser.role };
}

export const postBooking = asyncHandler(async (req: Request, res: Response) => {
  const current = actor(req);
  sendSuccess(res, "Booking created", await createBooking(current.id, req.body), 201);
});

export const getBookings = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as { page: number; limit: number };
  sendSuccess(res, "OK", await listBookings(actor(req), query.page, query.limit));
});

export const getBookingById = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await getBooking(actor(req), String(req.params.id)));
});

export const postCancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const current = actor(req);
  sendSuccess(res, "Booking cancelled", await cancelBookingByUser(current.id, String(req.params.id), req.body.reason));
});
