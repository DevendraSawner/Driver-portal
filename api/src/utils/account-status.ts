import type { AccountStatus } from "@prisma/client";
import { AUTH_ERROR } from "../constants/auth.js";
import { AppError } from "./app-error.js";

export function assertAccountCanAuthenticate(status: AccountStatus): void {
  switch (status) {
    case "ACTIVE":
      return;
    case "PENDING_VERIFICATION":
      throw new AppError(403, "Verify your phone before signing in", [
        { code: AUTH_ERROR.ACCOUNT_NOT_VERIFIED, message: "Phone verification is required" },
      ]);
    case "INACTIVE":
      throw new AppError(403, "This account is inactive", [
        { code: AUTH_ERROR.ACCOUNT_INACTIVE, message: "Account is inactive" },
      ]);
    case "SUSPENDED":
      throw new AppError(403, "This account is suspended", [
        { code: AUTH_ERROR.ACCOUNT_SUSPENDED, message: "Account is suspended" },
      ]);
    case "BLOCKED":
      throw new AppError(403, "This account is blocked", [
        { code: AUTH_ERROR.ACCOUNT_BLOCKED, message: "Account is blocked" },
      ]);
    default: {
      const neverStatus: never = status;
      throw new AppError(403, `Unsupported account status: ${neverStatus}`);
    }
  }
}
