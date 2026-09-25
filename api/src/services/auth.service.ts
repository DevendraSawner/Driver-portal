import type { OtpPurpose, User } from "@prisma/client";
import { env } from "../config/env.js";
import { AUTH_ERROR } from "../constants/auth.js";
import { otpRepository } from "../repositories/otp.repository.js";
import { refreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { userRepository, type PublicUser } from "../repositories/user.repository.js";
import { assertAccountCanAuthenticate } from "../utils/account-status.js";
import { AppError } from "../utils/app-error.js";
import { dayjs } from "../utils/dayjs.js";
import { signAccessToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateOtpCode, generateRefreshToken, hashOpaqueToken, hashOtp } from "../utils/secrets.js";
import { sendOtp } from "./otp-sender.js";
import type { z } from "zod";
import type {
  forgotPasswordSchema,
  loginSchema,
  otpResendSchema,
  otpVerifySchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;

export type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};

function genericOtpResponse(): { accepted: true } {
  return { accepted: true };
}

async function issueOtp(user: User, purpose: OtpPurpose): Promise<void> {
  const latest = await otpRepository.findLatestOpen(user.phone, purpose);
  if (latest) {
    const elapsed = dayjs().diff(dayjs(latest.createdAt), "second");
    if (elapsed < env.OTP_RESEND_COOLDOWN_SECONDS) {
      throw new AppError(429, "Wait before requesting another code", [
        { code: AUTH_ERROR.OTP_COOLDOWN, message: "OTP resend cooldown is active" },
      ]);
    }
    await otpRepository.consumeOpen(user.phone, purpose);
  }

  const code = generateOtpCode();
  await otpRepository.create({
    userId: user.id,
    phone: user.phone,
    purpose,
    codeHash: hashOtp(user.phone, purpose, code),
    expiresAt: dayjs().add(env.OTP_TTL_MINUTES, "minute").toDate(),
  });
  await sendOtp({ phone: user.phone, purpose, code });
}

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const existingPhone = await userRepository.findByPhone(input.phone);
  if (existingPhone && !existingPhone.deletedAt) {
    throw new AppError(409, "An account with this phone already exists");
  }

  if (input.email) {
    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail && !existingEmail.deletedAt) {
      throw new AppError(409, "An account with this email already exists");
    }
  }

  const user = await userRepository.create({
    role: input.role,
    phone: input.phone,
    ...(input.email ? { email: input.email } : {}),
    fullName: input.fullName,
    passwordHash: await hashPassword(input.password),
    status: "PENDING_VERIFICATION",
  });

  await issueOtp(user, "REGISTER");
  return userRepository.toPublic(user);
}

export async function resendOtp(input: z.infer<typeof otpResendSchema>): Promise<{ accepted: true }> {
  const user = await userRepository.findByPhone(input.phone);
  if (!user || user.deletedAt) {
    return genericOtpResponse();
  }

  if (input.purpose === "REGISTER" && user.status !== "PENDING_VERIFICATION") {
    return genericOtpResponse();
  }

  if (input.purpose === "PASSWORD_RESET" && (user.status === "BLOCKED" || user.status === "SUSPENDED")) {
    return genericOtpResponse();
  }

  try {
    await issueOtp(user, input.purpose);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 429) {
      throw error;
    }
    if (error instanceof AppError && error.statusCode === 503) {
      throw error;
    }
    return genericOtpResponse();
  }

  return genericOtpResponse();
}

export async function verifyOtp(input: z.infer<typeof otpVerifySchema>): Promise<PublicUser> {
  const user = await userRepository.findByPhone(input.phone);
  if (!user || user.deletedAt) {
    throw new AppError(400, "Invalid verification code", [
      { code: AUTH_ERROR.OTP_INVALID, message: "Invalid verification code" },
    ]);
  }

  const challenge = await otpRepository.findLatestOpen(input.phone, input.purpose);
  if (!challenge) {
    throw new AppError(400, "Invalid verification code", [
      { code: AUTH_ERROR.OTP_INVALID, message: "Invalid verification code" },
    ]);
  }

  if (dayjs(challenge.expiresAt).isBefore(dayjs())) {
    await otpRepository.consume(challenge.id);
    throw new AppError(400, "Verification code has expired", [
      { code: AUTH_ERROR.OTP_EXPIRED, message: "Verification code has expired" },
    ]);
  }

  if (challenge.attemptCount >= env.OTP_MAX_ATTEMPTS) {
    await otpRepository.consume(challenge.id);
    throw new AppError(400, "Too many invalid attempts", [
      { code: AUTH_ERROR.OTP_MAX_ATTEMPTS, message: "Too many invalid attempts" },
    ]);
  }

  const matches = hashOtp(input.phone, input.purpose, input.code) === challenge.codeHash;
  if (!matches) {
    await otpRepository.incrementAttempts(challenge.id);
    throw new AppError(400, "Invalid verification code", [
      { code: AUTH_ERROR.OTP_INVALID, message: "Invalid verification code" },
    ]);
  }

  await otpRepository.consume(challenge.id);

  if (input.purpose === "REGISTER") {
    const updated = await userRepository.update(user.id, {
      status: "ACTIVE",
      phoneVerifiedAt: new Date(),
    });
    return userRepository.toPublic(updated);
  }

  return userRepository.toPublic(user);
}

async function issueSession(user: User, meta: { userAgent?: string; ip?: string }): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();
  const stored = await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashOpaqueToken(refreshToken),
    expiresAt: dayjs().add(env.JWT_REFRESH_TTL_DAYS, "day").toDate(),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    sid: stored.id,
  });

  return {
    accessToken,
    refreshToken,
    user: userRepository.toPublic(user),
  };
}

export async function loginUser(
  input: LoginInput,
  meta: { userAgent?: string; ip?: string },
): Promise<IssuedSession> {
  const user = await userRepository.findByPhone(input.phone);
  const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;

  if (!user || user.deletedAt || !valid) {
    throw new AppError(401, "Invalid phone or password", [
      { code: AUTH_ERROR.INVALID_CREDENTIALS, message: "Invalid phone or password" },
    ]);
  }

  assertAccountCanAuthenticate(user.status);
  await userRepository.update(user.id, { lastLoginAt: new Date() });
  return issueSession(user, meta);
}

export async function refreshSession(
  refreshToken: string | undefined,
  meta: { userAgent?: string; ip?: string },
): Promise<IssuedSession> {
  if (!refreshToken) {
    throw new AppError(401, "Refresh token is required");
  }

  const existing = await refreshTokenRepository.findByHash(hashOpaqueToken(refreshToken));
  if (!existing || existing.revokedAt || dayjs(existing.expiresAt).isBefore(dayjs())) {
    throw new AppError(401, "Refresh token is invalid");
  }

  const user = await userRepository.findById(existing.userId);
  if (!user || user.deletedAt) {
    throw new AppError(401, "Refresh token is invalid");
  }

  assertAccountCanAuthenticate(user.status);

  const next = await issueSession(user, meta);
  const nextRecord = await refreshTokenRepository.findByHash(hashOpaqueToken(next.refreshToken));
  await refreshTokenRepository.revoke(existing.id, nextRecord?.id);
  return next;
}

export async function logoutSession(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }
  const existing = await refreshTokenRepository.findByHash(hashOpaqueToken(refreshToken));
  if (existing && !existing.revokedAt) {
    await refreshTokenRepository.revoke(existing.id);
  }
}

export async function logoutAllSessions(userId: string): Promise<void> {
  await refreshTokenRepository.revokeAllForUser(userId);
}

export async function forgotPassword(input: z.infer<typeof forgotPasswordSchema>): Promise<{ accepted: true }> {
  return resendOtp({ phone: input.phone, purpose: "PASSWORD_RESET" });
}

export async function resetPassword(input: z.infer<typeof resetPasswordSchema>): Promise<void> {
  const user = await verifyOtp({
    phone: input.phone,
    purpose: "PASSWORD_RESET",
    code: input.code,
  });
  await userRepository.update(user.id, { passwordHash: await hashPassword(input.newPassword) });
  await refreshTokenRepository.revokeAllForUser(user.id);
}
