import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPasswordHandler,
  login,
  logout,
  logoutAll,
  refresh,
  register,
  resendOtpHandler,
  resetPasswordHandler,
  verifyOtpHandler,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  otpResendSchema,
  otpVerifySchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests",
    errors: [],
  },
});

export const authRouter = Router();

authRouter.use(authLimiter);
authRouter.post("/register", validate({ body: registerSchema }), register);
authRouter.post("/otp/verify", validate({ body: otpVerifySchema }), verifyOtpHandler);
authRouter.post("/otp/resend", validate({ body: otpResendSchema }), resendOtpHandler);
authRouter.post("/login", validate({ body: loginSchema }), login);
authRouter.post("/refresh", validate({ body: refreshSchema }), refresh);
authRouter.post("/logout", validate({ body: logoutSchema }), logout);
authRouter.post("/logout-all", requireAuth, logoutAll);
authRouter.post("/forgot-password", validate({ body: forgotPasswordSchema }), forgotPasswordHandler);
authRouter.post("/reset-password", validate({ body: resetPasswordSchema }), resetPasswordHandler);
