import { Router } from "express";
import {
  createDriver,
  getDriver,
  getDrivers,
  postApproveDriver,
  postRejectDriver,
  postSuspendDriver,
} from "../controllers/admin-driver.controller.js";
import {
  getAdminDriverFinancials,
  getAdminFees,
  getAdminOutstandingFees,
  getAdminPayments,
  getAdminSettlements,
} from "../controllers/payment.controller.js";
import { getMe } from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/role.js";
import { validate } from "../middlewares/validate.js";
import {
  createDriverSchema,
  driverListQuerySchema,
  objectIdParamsSchema,
  rejectDriverSchema,
  suspendDriverSchema,
} from "../validators/driver.validator.js";
import { driverIdParamsSchema, paymentListQuerySchema } from "../validators/payment.validator.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRoles("ADMIN"));
adminRouter.get("/me", getMe);
adminRouter.get("/drivers", validate({ query: driverListQuerySchema }), getDrivers);
adminRouter.post("/drivers", validate({ body: createDriverSchema }), createDriver);
adminRouter.get("/drivers/:id", validate({ params: objectIdParamsSchema }), getDriver);
adminRouter.post("/drivers/:id/approve", validate({ params: objectIdParamsSchema }), postApproveDriver);
adminRouter.post("/drivers/:id/reject", validate({ params: objectIdParamsSchema, body: rejectDriverSchema }), postRejectDriver);
adminRouter.post("/drivers/:id/suspend", validate({ params: objectIdParamsSchema, body: suspendDriverSchema }), postSuspendDriver);
adminRouter.get("/payments", validate({ query: paymentListQuerySchema }), getAdminPayments);
adminRouter.get("/platform-fees/outstanding", validate({ query: paymentListQuerySchema }), getAdminOutstandingFees);
adminRouter.get("/platform-fees", validate({ query: paymentListQuerySchema }), getAdminFees);
adminRouter.get("/settlements", validate({ query: paymentListQuerySchema }), getAdminSettlements);
adminRouter.get("/driver-financials/:driverId", validate({ params: driverIdParamsSchema }), getAdminDriverFinancials);
