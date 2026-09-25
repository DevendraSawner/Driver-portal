import { z } from "zod";

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

const documentSchema = z.object({
  type: z.enum([
    "DRIVING_LICENSE",
    "IDENTITY_PROOF",
    "ADDRESS_PROOF",
    "POLICE_VERIFICATION",
    "PROFILE_PHOTO",
  ]),
  fileKey: z.string().trim().min(1).max(300),
  mimeType: z.string().trim().min(3).max(100),
});

export const createDriverSchema = z.object({
  phone: e164,
  password,
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().optional(),
  city: z.string().trim().min(2).max(80).optional(),
});

export const updateDriverProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80).optional(),
    avatarUrl: z.string().trim().url().max(500).nullable().optional(),
    city: z.string().trim().min(2).max(80).nullable().optional(),
    dateOfBirth: z.string().date().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export const submitKycSchema = z.object({
  documents: z.array(documentSchema).min(1).max(10),
});

export const rejectDriverSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const suspendDriverSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const driverListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(80).optional(),
  kycStatus: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]).optional(),
  accountStatus: z.enum(["PENDING_VERIFICATION", "ACTIVE", "INACTIVE", "SUSPENDED", "BLOCKED"]).optional(),
});

export const objectIdParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});
