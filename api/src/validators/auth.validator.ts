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

export const registerSchema = z.object({
  role: z.enum(["USER", "DRIVER"]),
  phone: e164,
  email: z.string().trim().email().optional(),
  password,
  fullName: z.string().trim().min(2).max(80),
});

export const loginSchema = z.object({
  phone: e164,
  password: z.string().min(1).max(72),
});

export const otpVerifySchema = z.object({
  phone: e164,
  purpose: z.enum(["REGISTER", "PASSWORD_RESET"]),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const otpResendSchema = z.object({
  phone: e164,
  purpose: z.enum(["REGISTER", "PASSWORD_RESET"]),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});

export const forgotPasswordSchema = z.object({
  phone: e164,
});

export const resetPasswordSchema = z.object({
  phone: e164,
  code: z.string().regex(/^\d{6}$/),
  newPassword: password,
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});
