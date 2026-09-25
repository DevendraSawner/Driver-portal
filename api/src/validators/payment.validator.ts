import { z } from "zod";

export const platformPaymentSchema = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i),
});

export const directPaymentSchema = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i),
  method: z.enum(["CASH", "UPI", "BANK_TRANSFER"]),
  reference: z.string().trim().min(3).max(80).optional(),
});

export const webhookSchema = z.object({
  providerRef: z.string().trim().min(8).max(120),
  status: z.enum(["SUCCESS", "FAILED"]),
});

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const driverIdParamsSchema = z.object({
  driverId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});
