import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { OTP_LENGTH } from "../constants/auth.js";
import { env } from "../config/env.js";

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function generateOtpCode(): string {
  const max = 10 ** OTP_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

export function hashOtp(phone: string, purpose: string, code: string): string {
  return createHmac("sha256", env.OTP_HASH_SECRET).update(`${purpose}:${phone}:${code}`).digest("hex");
}
