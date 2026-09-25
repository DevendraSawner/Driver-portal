import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { AUTH_ERROR } from "../constants/auth.js";

export type OtpMessage = {
  phone: string;
  purpose: "REGISTER" | "PASSWORD_RESET";
  code: string;
};

export async function sendOtp(message: OtpMessage): Promise<void> {
  if (env.OTP_DELIVERY === "disabled") {
    throw new AppError(503, "OTP delivery is not configured", [
      { code: AUTH_ERROR.OTP_UNAVAILABLE, message: "OTP delivery is not configured" },
    ]);
  }

  if (env.NODE_ENV === "test") {
    return;
  }

  console.info(
    JSON.stringify({
      message: "Development OTP issued. Do not enable console delivery in production.",
      phone: message.phone,
      purpose: message.purpose,
      code: message.code,
    }),
  );
}
