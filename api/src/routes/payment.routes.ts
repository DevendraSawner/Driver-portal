import { Router } from "express";
import {
  getPayment,
  postConfirmPayment,
  postDirectPayment,
  postPayment,
  postWebhook,
} from "../controllers/payment.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/role.js";
import { validate } from "../middlewares/validate.js";
import { objectIdParamsSchema } from "../validators/driver.validator.js";
import { directPaymentSchema, platformPaymentSchema, webhookSchema } from "../validators/payment.validator.js";

export const paymentRouter = Router();

paymentRouter.post("/webhooks/:provider", validate({ body: webhookSchema }), postWebhook);
paymentRouter.use(requireAuth);
paymentRouter.post("/", requireRoles("USER"), validate({ body: platformPaymentSchema }), postPayment);
paymentRouter.post("/direct", requireRoles("USER"), validate({ body: directPaymentSchema }), postDirectPayment);
paymentRouter.get("/:id", validate({ params: objectIdParamsSchema }), getPayment);
paymentRouter.post("/:id/confirm", requireRoles("DRIVER"), validate({ params: objectIdParamsSchema }), postConfirmPayment);
