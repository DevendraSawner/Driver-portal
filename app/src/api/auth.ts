import { postData } from "./client";
import type { Account } from "../types/models";

export function login(phone: string, password: string) {
  return postData<{ accessToken: string; refreshToken: string; user: Account }>("/api/v1/auth/login", { phone, password });
}

export function register(input: { role: "USER" | "DRIVER"; phone: string; password: string; fullName: string; email?: string }) {
  return postData<{ user: Account }>("/api/v1/auth/register", input);
}

export function verifyOtp(input: { phone: string; purpose: "REGISTER" | "PASSWORD_RESET"; code: string }) {
  return postData<{ user: Account }>("/api/v1/auth/otp/verify", input);
}

export function resendOtp(phone: string, purpose: "REGISTER" | "PASSWORD_RESET") {
  return postData("/api/v1/auth/otp/resend", { phone, purpose });
}

export function logout(refreshToken: string | undefined) {
  return postData("/api/v1/auth/logout", { refreshToken });
}
