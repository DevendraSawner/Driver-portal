import { describe, expect, it } from "vitest";
import { splitEstimatedFare } from "../src/services/booking-pricing.js";
import {
  amountsFromBooking,
  applyFeeSettlement,
  assertPaymentSlotOpen,
  emptyLedger,
  isFinanciallyRecognized,
  planOutstandingSettlement,
  recognizeDirectConfirmation,
  recognizePlatformCapture,
  sumOutstanding,
} from "../src/services/finance-rules.js";
import { AppError } from "../src/utils/app-error.js";

const trip = {
  estimatedFareMinor: 100_000,
  platformFeeMinor: 10_000,
  driverEarningMinor: 90_000,
  currency: "INR",
};

describe("platform fee and driver earning", () => {
  it("splits ₹1,000 into a ₹100 fee and ₹900 earning from server configuration", () => {
    const quote = splitEstimatedFare(100_000);
    expect(quote.platformFeeMinor).toBe(10_000);
    expect(quote.driverEarningMinor).toBe(90_000);
    expect(quote.estimatedFareMinor).toBe(quote.platformFeeMinor + quote.driverEarningMinor);
  });

  it("uses the booking snapshot and rejects a mismatched fee", () => {
    expect(amountsFromBooking(trip).tripAmountMinor).toBe(100_000);
    expect(() =>
      amountsFromBooking({ ...trip, platformFeeMinor: 1 }),
    ).toThrow(AppError);
  });
});

describe("direct payment", () => {
  it("records the fare received by the driver and leaves the platform fee outstanding", () => {
    const amounts = amountsFromBooking(trip);
    const result = recognizeDirectConfirmation(emptyLedger(), amounts);
    expect(result.feeStatus).toBe("DUE");
    expect(result.balances.outstandingFeeMinor).toBe(10_000);
    expect(result.balances.payableMinor).toBe(0);
    expect(result.balances.lifetimeDirectReceivedMinor).toBe(100_000);
    expect(result.balances.lifetimeEarningMinor).toBe(90_000);
  });
});

describe("duplicate payment prevention", () => {
  it("blocks a second payment while one is open or successful", () => {
    expect(() => assertPaymentSlotOpen([])).not.toThrow();
    expect(() => assertPaymentSlotOpen([{ status: "FAILED" }])).not.toThrow();
    for (const status of ["PENDING", "PROCESSING", "SUCCESS", "REFUNDED", "DISPUTED"] as const) {
      expect(() => assertPaymentSlotOpen([{ status }])).toThrow(AppError);
    }
  });

  it("does not recognize a capture that was already recorded", () => {
    expect(isFinanciallyRecognized("SUCCESS")).toBe(true);
    expect(isFinanciallyRecognized("PROCESSING")).toBe(false);
  });
});

describe("settlement and outstanding fees", () => {
  it("settles the full outstanding balance and rejects any other amount", () => {
    const due = recognizeDirectConfirmation(emptyLedger(), amountsFromBooking(trip));
    const plan = planOutstandingSettlement([
      { id: "fee-1", amountMinor: 10_000, status: "DUE" },
      { id: "fee-2", amountMinor: 10_000, status: "PAID" },
    ]);
    expect(plan).toEqual({ amountMinor: 10_000, feeIds: ["fee-1"] });
    const settled = applyFeeSettlement(due.balances, plan.amountMinor);
    expect(settled.balances.outstandingFeeMinor).toBe(0);
    expect(() => applyFeeSettlement(due.balances, 9_999)).toThrow(AppError);
  });

  it("sums only fees that are still due", () => {
    expect(
      sumOutstanding([
        { amountMinor: 10_000, status: "DUE" },
        { amountMinor: 5_000, status: "DUE" },
        { amountMinor: 10_000, status: "PAID" },
        { amountMinor: 10_000, status: "PENDING" },
      ]),
    ).toBe(15_000);
    expect(() => planOutstandingSettlement([{ id: "fee-1", amountMinor: 10_000, status: "PAID" }])).toThrow(AppError);
  });

  it("keeps the platform fee when the customer pays the platform", () => {
    const result = recognizePlatformCapture(emptyLedger(), amountsFromBooking(trip));
    expect(result.feeStatus).toBe("PAID");
    expect(result.balances.payableMinor).toBe(90_000);
    expect(result.balances.outstandingFeeMinor).toBe(0);
  });
});
