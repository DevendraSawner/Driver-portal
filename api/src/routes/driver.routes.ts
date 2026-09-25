import { Router } from "express";
import {
  getRequests,
  postAccept,
  postArrived,
  postAvailability,
  postDriverCancel,
  postEnRoute,
  postReject,
} from "../controllers/driver-booking.controller.js";
import {
  getDriverLedger,
  getDriverPlatformFees,
  getDriverSettlementList,
  getDriverWallet,
  postPayPlatformFees,
} from "../controllers/payment.controller.js";
import { getKyc, getKycStatus, getProfile, patchProfile, postKyc } from "../controllers/driver.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/role.js";
import { validate } from "../middlewares/validate.js";
import { availabilitySchema, cancelBookingSchema, objectIdParamsSchema, rejectOfferSchema } from "../validators/booking.validator.js";
import { submitKycSchema, updateDriverProfileSchema } from "../validators/driver.validator.js";
import { paymentListQuerySchema } from "../validators/payment.validator.js";

export const driverRouter = Router();

driverRouter.use(requireAuth, requireRoles("DRIVER"));
driverRouter.get("/profile", getProfile);
driverRouter.patch("/profile", validate({ body: updateDriverProfileSchema }), patchProfile);
driverRouter.post("/kyc", validate({ body: submitKycSchema }), postKyc);
driverRouter.get("/kyc/status", getKycStatus);
driverRouter.get("/kyc", getKyc);
driverRouter.post("/availability", validate({ body: availabilitySchema }), postAvailability);
driverRouter.get("/bookings/requests", getRequests);
driverRouter.post("/bookings/:id/accept", validate({ params: objectIdParamsSchema }), postAccept);
driverRouter.post("/bookings/:id/reject", validate({ params: objectIdParamsSchema, body: rejectOfferSchema }), postReject);
driverRouter.post("/bookings/:id/en-route", validate({ params: objectIdParamsSchema }), postEnRoute);
driverRouter.post("/bookings/:id/arrived", validate({ params: objectIdParamsSchema }), postArrived);
driverRouter.post("/bookings/:id/cancel", validate({ params: objectIdParamsSchema, body: cancelBookingSchema }), postDriverCancel);
driverRouter.get("/wallet", getDriverWallet);
driverRouter.get("/ledger", validate({ query: paymentListQuerySchema }), getDriverLedger);
driverRouter.get("/platform-fees", getDriverPlatformFees);
driverRouter.get("/settlements", validate({ query: paymentListQuerySchema }), getDriverSettlementList);
driverRouter.post("/platform-fees/pay", postPayPlatformFees);
