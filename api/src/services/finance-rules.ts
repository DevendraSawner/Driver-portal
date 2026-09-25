import type { PaymentStatus, PlatformFeeStatus } from "@prisma/client";
import { AppError } from "../utils/app-error.js";

export type TripAmounts = {
  tripAmountMinor: number;
  platformFeeMinor: number;
  driverEarningMinor: number;
  currency: string;
};

export type LedgerBalances = {
  payableMinor: number;
  outstandingFeeMinor: number;
  lifetimeEarningMinor: number;
  lifetimeDirectReceivedMinor: number;
  lifetimePlatformFeeMinor: number;
};

export type LedgerEntryPlan = {
  account: "DRIVER_EARNING" | "DRIVER_PAYABLE" | "PLATFORM_FEE_RECEIVABLE" | "PLATFORM_CASH";
  direction: "DEBIT" | "CREDIT";
  amountMinor: number;
  balanceAfterMinor: number;
  memo: string;
};

const BLOCKING_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "REFUNDED",
  "DISPUTED",
];

export function emptyLedger(currency = "INR"): LedgerBalances & { currency: string } {
  return {
    payableMinor: 0,
    outstandingFeeMinor: 0,
    lifetimeEarningMinor: 0,
    lifetimeDirectReceivedMinor: 0,
    lifetimePlatformFeeMinor: 0,
    currency,
  };
}

export function amountsFromBooking(booking: {
  estimatedFareMinor: number;
  platformFeeMinor: number;
  driverEarningMinor: number;
  currency: string;
}): TripAmounts {
  if (booking.platformFeeMinor < 0 || booking.driverEarningMinor < 0 || booking.estimatedFareMinor <= 0) {
    throw new AppError(422, "Booking amounts are invalid");
  }
  if (booking.estimatedFareMinor !== booking.platformFeeMinor + booking.driverEarningMinor) {
    throw new AppError(422, "Booking amounts are inconsistent");
  }
  return {
    tripAmountMinor: booking.estimatedFareMinor,
    platformFeeMinor: booking.platformFeeMinor,
    driverEarningMinor: booking.driverEarningMinor,
    currency: booking.currency,
  };
}

export function assertPaymentSlotOpen(existing: { status: PaymentStatus }[]): void {
  if (existing.some((payment) => BLOCKING_PAYMENT_STATUSES.includes(payment.status))) {
    throw new AppError(409, "A payment is already in progress or completed for this booking");
  }
}

export function isFinanciallyRecognized(status: PaymentStatus): boolean {
  return status === "SUCCESS" || status === "REFUNDED";
}

export function recognizePlatformCapture(state: LedgerBalances, amounts: TripAmounts): {
  balances: LedgerBalances;
  entries: LedgerEntryPlan[];
  feeStatus: PlatformFeeStatus;
} {
  const balances: LedgerBalances = {
    ...state,
    payableMinor: state.payableMinor + amounts.driverEarningMinor,
    lifetimeEarningMinor: state.lifetimeEarningMinor + amounts.driverEarningMinor,
    lifetimePlatformFeeMinor: state.lifetimePlatformFeeMinor + amounts.platformFeeMinor,
  };
  return {
    balances,
    feeStatus: "PAID",
    entries: [
      {
        account: "PLATFORM_CASH",
        direction: "CREDIT",
        amountMinor: amounts.tripAmountMinor,
        balanceAfterMinor: amounts.tripAmountMinor,
        memo: "Customer paid the platform",
      },
      {
        account: "DRIVER_PAYABLE",
        direction: "CREDIT",
        amountMinor: amounts.driverEarningMinor,
        balanceAfterMinor: balances.payableMinor,
        memo: "Driver earning payable by the platform",
      },
      {
        account: "DRIVER_EARNING",
        direction: "CREDIT",
        amountMinor: amounts.driverEarningMinor,
        balanceAfterMinor: balances.lifetimeEarningMinor,
        memo: "Driver earning recognized",
      },
      {
        account: "PLATFORM_FEE_RECEIVABLE",
        direction: "CREDIT",
        amountMinor: amounts.platformFeeMinor,
        balanceAfterMinor: state.outstandingFeeMinor,
        memo: "Platform fee collected at source",
      },
    ],
  };
}

export function recognizeDirectConfirmation(state: LedgerBalances, amounts: TripAmounts): {
  balances: LedgerBalances;
  entries: LedgerEntryPlan[];
  feeStatus: PlatformFeeStatus;
} {
  const balances: LedgerBalances = {
    ...state,
    outstandingFeeMinor: state.outstandingFeeMinor + amounts.platformFeeMinor,
    lifetimeEarningMinor: state.lifetimeEarningMinor + amounts.driverEarningMinor,
    lifetimeDirectReceivedMinor: state.lifetimeDirectReceivedMinor + amounts.tripAmountMinor,
    lifetimePlatformFeeMinor: state.lifetimePlatformFeeMinor + amounts.platformFeeMinor,
  };
  return {
    balances,
    feeStatus: "DUE",
    entries: [
      {
        account: "DRIVER_EARNING",
        direction: "CREDIT",
        amountMinor: amounts.driverEarningMinor,
        balanceAfterMinor: balances.lifetimeEarningMinor,
        memo: "Driver earning recognized on direct payment",
      },
      {
        account: "PLATFORM_FEE_RECEIVABLE",
        direction: "DEBIT",
        amountMinor: amounts.platformFeeMinor,
        balanceAfterMinor: balances.outstandingFeeMinor,
        memo: "Platform fee due from the driver",
      },
    ],
  };
}

export function planOutstandingSettlement(fees: { id: string; amountMinor: number; status: PlatformFeeStatus }[]): {
  amountMinor: number;
  feeIds: string[];
} {
  const due = fees.filter((fee) => fee.status === "DUE");
  const amountMinor = due.reduce((sum, fee) => sum + fee.amountMinor, 0);
  if (due.length === 0 || amountMinor <= 0) {
    throw new AppError(422, "There are no outstanding platform fees");
  }
  return { amountMinor, feeIds: due.map((fee) => fee.id) };
}

export function applyFeeSettlement(state: LedgerBalances, amountMinor: number): {
  balances: LedgerBalances;
  entries: LedgerEntryPlan[];
} {
  if (amountMinor !== state.outstandingFeeMinor) {
    throw new AppError(422, "Settlement amount does not match outstanding platform fees");
  }
  const balances: LedgerBalances = {
    ...state,
    outstandingFeeMinor: state.outstandingFeeMinor - amountMinor,
  };
  return {
    balances,
    entries: [
      {
        account: "PLATFORM_FEE_RECEIVABLE",
        direction: "CREDIT",
        amountMinor,
        balanceAfterMinor: balances.outstandingFeeMinor,
        memo: "Driver paid outstanding platform fees",
      },
      {
        account: "PLATFORM_CASH",
        direction: "CREDIT",
        amountMinor,
        balanceAfterMinor: amountMinor,
        memo: "Platform fee cash received",
      },
    ],
  };
}

export function sumOutstanding(fees: { amountMinor: number; status: PlatformFeeStatus }[]): number {
  return fees.filter((fee) => fee.status === "DUE").reduce((sum, fee) => sum + fee.amountMinor, 0);
}
