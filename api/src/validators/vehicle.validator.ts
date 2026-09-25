import { z } from "zod";

const registrationNumber = z
  .string()
  .trim()
  .min(4)
  .max(20)
  .regex(/^[A-Za-z0-9-]+$/, "Registration number must be letters, numbers, or hyphens");

export const vehicleSchema = z.object({
  registrationNumber,
  vehicleType: z.enum(["HATCHBACK", "SEDAN", "SUV", "MUV", "LUXURY", "OTHER"]),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  transmission: z.enum(["MANUAL", "AUTOMATIC"]),
  fuelType: z.enum(["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"]),
  color: z.string().trim().min(1).max(40).optional(),
  rcFileKey: z.string().trim().min(1).max(300).optional(),
});

export const updateVehicleSchema = vehicleSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});
