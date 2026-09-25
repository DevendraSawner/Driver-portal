import { describe, expect, it } from "vitest";
import { canReceiveBookings, canSubmitKyc } from "../src/services/driver-eligibility.js";

describe("driver booking eligibility", () => {
  it("allows only an approved active driver", () => {
    expect(
      canReceiveBookings({ kycStatus: "APPROVED", accountStatus: "ACTIVE", deletedAt: null }),
    ).toBe(true);
  });

  it("blocks drivers who are not approved or not active", () => {
    expect(canReceiveBookings({ kycStatus: "PENDING", accountStatus: "ACTIVE", deletedAt: null })).toBe(false);
    expect(canReceiveBookings({ kycStatus: "UNDER_REVIEW", accountStatus: "ACTIVE", deletedAt: null })).toBe(false);
    expect(canReceiveBookings({ kycStatus: "REJECTED", accountStatus: "ACTIVE", deletedAt: null })).toBe(false);
    expect(canReceiveBookings({ kycStatus: "APPROVED", accountStatus: "SUSPENDED", deletedAt: null })).toBe(false);
    expect(
      canReceiveBookings({ kycStatus: "APPROVED", accountStatus: "ACTIVE", deletedAt: new Date() }),
    ).toBe(false);
  });

  it("allows KYC submission only from pending or rejected", () => {
    expect(canSubmitKyc("PENDING")).toBe(true);
    expect(canSubmitKyc("REJECTED")).toBe(true);
    expect(canSubmitKyc("UNDER_REVIEW")).toBe(false);
    expect(canSubmitKyc("APPROVED")).toBe(false);
  });
});
