import { z } from "zod";
import { objectIdParamsSchema } from "./driver.validator.js";

const locationSchema = z.object({
  address: z.string().trim().min(3).max(300),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

export const createBookingSchema = z
  .object({
    vehicleId: z.string().regex(/^[a-f\d]{24}$/i),
    type: z.enum(["IMMEDIATE", "SCHEDULED"]),
    scheduledAt: z.string().datetime().optional(),
    pickup: locationSchema,
    destination: locationSchema,
    estimatedFareMinor: z.number().int().positive().max(10_000_000),
  })
  .superRefine((value, context) => {
    if (value.type === "SCHEDULED" && !value.scheduledAt) {
      context.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "Scheduled time is required",
      });
    }
  });

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const rejectOfferSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const bookingListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const availabilitySchema = z.object({
  online: z.boolean(),
});

export { objectIdParamsSchema };
