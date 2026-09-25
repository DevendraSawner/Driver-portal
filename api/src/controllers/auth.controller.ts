import type { Request, Response } from "express";
import {
  forgotPassword,
  loginUser,
  logoutAllSessions,
  logoutSession,
  refreshSession,
  registerUser,
  resendOtp,
  resetPassword,
  verifyOtp,
} from "../services/auth.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { clearRefreshCookie, setRefreshCookie } from "../utils/refresh-cookie.js";
import { AppError } from "../utils/app-error.js";

function requestMeta(req: Request): { userAgent?: string; ip?: string } {
  return {
    userAgent: req.header("user-agent")?.slice(0, 200),
    ip: req.ip,
  };
}

function wantsMobileToken(req: Request): boolean {
  return req.header("x-client-type") === "mobile";
}

function presentedRefreshToken(req: Request): string | undefined {
  const bodyToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  const cookieToken = req.cookies?.refreshToken as string | undefined;
  return bodyToken ?? cookieToken;
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await registerUser(req.body);
  sendSuccess(res, "Account created. Verify the code sent to your phone.", { user }, 201);
});

export const verifyOtpHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await verifyOtp(req.body);
  sendSuccess(res, "Verification successful", { user });
});

export const resendOtpHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await resendOtp(req.body);
  sendSuccess(res, "If the account can receive a code, it has been sent", result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const session = await loginUser(req.body, requestMeta(req));
  const mobile = wantsMobileToken(req);
  if (!mobile) {
    setRefreshCookie(res, session.refreshToken);
  }

  sendSuccess(res, "Signed in", {
    accessToken: session.accessToken,
    refreshToken: mobile ? session.refreshToken : undefined,
    user: session.user,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const session = await refreshSession(presentedRefreshToken(req), requestMeta(req));
  const mobile = wantsMobileToken(req);
  if (!mobile) {
    setRefreshCookie(res, session.refreshToken);
  }

  sendSuccess(res, "Session refreshed", {
    accessToken: session.accessToken,
    refreshToken: mobile ? session.refreshToken : undefined,
    user: session.user,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await logoutSession(presentedRefreshToken(req));
  clearRefreshCookie(res);
  sendSuccess(res, "Signed out", {});
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  await logoutAllSessions(req.authUser.id);
  clearRefreshCookie(res);
  sendSuccess(res, "All sessions signed out", {});
});

export const forgotPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  await forgotPassword(req.body);
  sendSuccess(res, "If the account can receive a code, it has been sent", { accepted: true });
});

export const resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  await resetPassword(req.body);
  sendSuccess(res, "Password updated", {});
});
