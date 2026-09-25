import { z } from "zod";

const e164 = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format");

export const updateMeSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().email().nullable().optional(),
    avatarUrl: z.string().trim().url().max(500).nullable().optional(),
    city: z.string().trim().min(2).max(80).nullable().optional(),
    emergencyContactName: z.string().trim().min(2).max(80).nullable().optional(),
    emergencyContactPhone: e164.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });
