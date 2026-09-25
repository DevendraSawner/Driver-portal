import { Router } from "express";
import { getBookingById, getBookings, postBooking, postCancelBooking } from "../controllers/booking.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/role.js";
import { validate } from "../middlewares/validate.js";
import { bookingListQuerySchema, cancelBookingSchema, createBookingSchema, objectIdParamsSchema } from "../validators/booking.validator.js";

export const bookingRouter = Router();

bookingRouter.use(requireAuth);
bookingRouter.post("/", requireRoles("USER"), validate({ body: createBookingSchema }), postBooking);
bookingRouter.get("/", validate({ query: bookingListQuerySchema }), getBookings);
bookingRouter.get("/:id", validate({ params: objectIdParamsSchema }), getBookingById);
bookingRouter.post("/:id/cancel", requireRoles("USER"), validate({ params: objectIdParamsSchema, body: cancelBookingSchema }), postCancelBooking);
