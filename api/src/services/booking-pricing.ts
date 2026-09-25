import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export function splitEstimatedFare(estimatedFareMinor: number): {
  estimatedFareMinor: number;
  platformFeeMinor: number;
  driverEarningMinor: number;
  feeBps: number;
  currency: "INR";
} {
  const feeBps = env.PLATFORM_FEE_BPS;
  const platformFeeMinor = Math.round((estimatedFareMinor * feeBps) / 10_000);
  if (platformFeeMinor > estimatedFareMinor) {
    throw new AppError(422, "Platform fee cannot exceed the estimated fare");
  }
  return {
    estimatedFareMinor,
    platformFeeMinor,
    driverEarningMinor: estimatedFareMinor - platformFeeMinor,
    feeBps,
    currency: "INR",
  };
}
