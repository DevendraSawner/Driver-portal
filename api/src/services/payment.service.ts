import { timingSafeEqual } from "node:crypto";
import type { Payment, PlatformFeeStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { bookingRepository } from "../repositories/booking.repository.js";
import {
  ledgerRepository,
  paymentRepository,
  platformFeeRepository,
  settlementRepository,
} from "../repositories/payment.repository.js";
import { AppError } from "../utils/app-error.js";
import { pagination, paginationMeta } from "../utils/pagination.js";
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
  type LedgerBalances,
  type LedgerEntryPlan,
  type TripAmounts,
} from "./finance-rules.js";
import { getPaymentProvider } from "./payment-provider.js";

type Actor = { id: string; role: "ADMIN" | "DRIVER" | "USER" };

function paymentView(payment: Payment) {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    rail: payment.rail,
    receiver: payment.receiver,
    directMethod: payment.directMethod,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    status: payment.status,
    directConfirmStatus: payment.directConfirmStatus,
    customerReference: payment.customerReference,
    provider: payment.provider,
    providerRef: payment.providerRef,
    checkoutUrl: payment.provider === "phonepe" ? payment.customerReference : null,
    createdAt: payment.createdAt,
  };
}

async function payableBooking(bookingId: string) {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking || !booking.driverId) {
    throw new AppError(404, "Booking not found");
  }
  if (booking.status !== "TRIP_COMPLETED") {
    throw new AppError(409, "Payment is available only after the trip is completed");
  }
  return booking;
}

async function writeLedger(
  driverId: string,
  currency: string,
  balances: {
    payableMinor: number;
    outstandingFeeMinor: number;
    lifetimeEarningMinor: number;
    lifetimeDirectReceivedMinor: number;
    lifetimePlatformFeeMinor: number;
  },
  entries: LedgerEntryPlan[],
  bookingId: string,
  settlementId?: string,
) {
  await prisma.driverLedger.upsert({
    where: { driverId },
    create: { driverId, currency, ...balances },
    update: balances,
  });
  if (entries.length === 0) {
    return;
  }
  await prisma.walletTransaction.createMany({
    data: entries.map((entry) => ({
      driverId,
      bookingId,
      settlementId,
      account: entry.account,
      direction: entry.direction,
      amountMinor: entry.amountMinor,
      currency,
      balanceAfterMinor: entry.balanceAfterMinor,
      memo: entry.memo,
    })),
  });
}

async function audit(actorUserId: string | undefined, action: string, entityType: string, entityId: string, summary: string) {
  await prisma.auditLog.create({
    data: { actorUserId, action, entityType, entityId, summary },
  });
}

export async function createPlatformPayment(userId: string, bookingId: string, idempotencyKey: string) {
  const existingKey = await paymentRepository.findByIdempotency(userId, idempotencyKey);
  if (existingKey) {
    if (existingKey.bookingId !== bookingId) {
      throw new AppError(409, "Idempotency key was already used");
    }
    return paymentView(existingKey);
  }

  const booking = await payableBooking(bookingId);
  if (booking.userId !== userId) {
    throw new AppError(404, "Booking not found");
  }
  const amounts = amountsFromBooking(booking);
  assertPaymentSlotOpen(await paymentRepository.listForBooking(bookingId));

  const provider = getPaymentProvider();
  const charge = await provider.createCharge({
    amountMinor: amounts.tripAmountMinor,
    currency: amounts.currency,
    referenceId: bookingId,
    idempotencyKey,
  });

  const payment = await paymentRepository.create({
    booking: { connect: { id: bookingId } },
    payerUserId: userId,
    driverId: booking.driverId,
    rail: "PLATFORM_PAYMENT",
    receiver: "PLATFORM",
    amountMinor: amounts.tripAmountMinor,
    currency: amounts.currency,
    status: "PROCESSING",
    provider: charge.provider,
    providerRef: charge.providerRef,
    customerReference: charge.checkoutUrl,
    idempotencyKey,
  });
  await platformFeeRepository.create({
    bookingId,
    paymentId: payment.id,
    driverId: booking.driverId as string,
    amountMinor: amounts.platformFeeMinor,
    currency: amounts.currency,
    status: "PENDING",
  });
  await audit(userId, "PAYMENT_CREATED", "Payment", payment.id, "Platform payment started");
  return paymentView(payment);
}

export async function createDirectPayment(
  userId: string,
  input: { bookingId: string; method: "CASH" | "UPI" | "BANK_TRANSFER"; reference?: string },
  idempotencyKey: string,
) {
  const existingKey = await paymentRepository.findByIdempotency(userId, idempotencyKey);
  if (existingKey) {
    if (existingKey.bookingId !== input.bookingId) {
      throw new AppError(409, "Idempotency key was already used");
    }
    return paymentView(existingKey);
  }

  const booking = await payableBooking(input.bookingId);
  if (booking.userId !== userId) {
    throw new AppError(404, "Booking not found");
  }
  const amounts = amountsFromBooking(booking);
  assertPaymentSlotOpen(await paymentRepository.listForBooking(input.bookingId));

  const payment = await paymentRepository.create({
    booking: { connect: { id: input.bookingId } },
    payerUserId: userId,
    driverId: booking.driverId,
    rail: "DIRECT_PAYMENT",
    receiver: "DRIVER",
    directMethod: input.method,
    amountMinor: amounts.tripAmountMinor,
    currency: amounts.currency,
    status: "PENDING",
    directConfirmStatus: "AWAITING_DRIVER",
    customerReference: input.reference,
    idempotencyKey,
  });
  await platformFeeRepository.create({
    bookingId: input.bookingId,
    paymentId: payment.id,
    driverId: booking.driverId as string,
    amountMinor: amounts.platformFeeMinor,
    currency: amounts.currency,
    status: "PENDING",
  });
  await audit(userId, "DIRECT_PAYMENT_DECLARED", "Payment", payment.id, "Direct payment declared");
  return paymentView(payment);
}

export async function confirmDirectPayment(driverId: string, paymentId: string) {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment || payment.driverId !== driverId || payment.rail !== "DIRECT_PAYMENT") {
    throw new AppError(404, "Payment not found");
  }
  if (isFinanciallyRecognized(payment.status)) {
    throw new AppError(409, "This payment is already confirmed");
  }
  if (payment.status !== "PENDING") {
    throw new AppError(409, "This payment cannot be confirmed");
  }

  const booking = await payableBooking(payment.bookingId);
  const amounts = amountsFromBooking(booking);
  if (amounts.tripAmountMinor !== payment.amountMinor) {
    throw new AppError(409, "Payment amount does not match the booking");
  }

  const current = (await ledgerRepository.findByDriver(driverId)) ?? emptyLedger(amounts.currency);
  const recognized = recognizeDirectConfirmation(current, amounts);
  await postRecognition(payment, amounts, recognized.balances, recognized.entries, recognized.feeStatus, "CUSTOMER_DIRECT_PAYMENT");
  const updated = await paymentRepository.update(payment.id, {
    status: "SUCCESS",
    directConfirmStatus: "CONFIRMED",
    confirmedByDriverAt: new Date(),
  });
  await audit(driverId, "DIRECT_PAYMENT_CONFIRMED", "Payment", payment.id, "Driver confirmed the booking amount");
  return paymentView(updated);
}

async function postRecognition(
  payment: Payment,
  amounts: TripAmounts,
  balances: LedgerBalances,
  entries: LedgerEntryPlan[],
  feeStatus: PlatformFeeStatus,
  txnType: "CUSTOMER_PLATFORM_PAYMENT" | "CUSTOMER_DIRECT_PAYMENT",
) {
  const driverId = payment.driverId;
  if (!driverId) {
    throw new AppError(409, "Booking has no driver");
  }
  const fee = await platformFeeRepository.findByBooking(payment.bookingId);
  if (!fee) {
    throw new AppError(409, "Platform fee is missing");
  }
  await prisma.paymentTransaction.create({
    data: {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      type: txnType,
      amountMinor: amounts.tripAmountMinor,
      currency: amounts.currency,
      provider: payment.provider,
      providerRef: payment.providerRef,
      status: "SUCCESS",
    },
  });
  await platformFeeRepository.update(fee.id, feeStatus);
  await writeLedger(driverId, amounts.currency, balances, entries, payment.bookingId);
}

export async function getPaymentForActor(actor: Actor, paymentId: string) {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }
  const allowed =
    actor.role === "ADMIN" ||
    payment.payerUserId === actor.id ||
    (actor.role === "DRIVER" && payment.driverId === actor.id);
  if (!allowed) {
    throw new AppError(404, "Payment not found");
  }
  return paymentView(payment);
}

export function assertWebhookSecret(presented: string | undefined): void {
  const expected = env.PAYMENT_WEBHOOK_SECRET;
  const given = presented ?? "";
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new AppError(401, "Invalid webhook secret");
  }
}

export async function applyProviderEvent(providerRef: string, status: "SUCCESS" | "FAILED") {
  const payment = await paymentRepository.findByProviderRef(providerRef);
  if (payment) {
    return applyPaymentProviderEvent(payment, status);
  }
  const settlement = await settlementRepository.findByProviderRef(providerRef);
  if (!settlement) {
    throw new AppError(404, "Provider reference not found");
  }
  return applySettlementProviderEvent(settlement.id, status);
}

async function applyPaymentProviderEvent(payment: Payment, status: "SUCCESS" | "FAILED") {
  if (isFinanciallyRecognized(payment.status)) {
    return paymentView(payment);
  }
  if (status === "FAILED") {
    const updated = await paymentRepository.update(payment.id, { status: "FAILED" });
    const fee = await platformFeeRepository.findByBooking(payment.bookingId);
    if (fee && fee.status === "PENDING") {
      await platformFeeRepository.update(fee.id, "WAIVED");
    }
    await audit(undefined, "PAYMENT_FAILED", "Payment", payment.id, "Provider reported failure");
    return paymentView(updated);
  }

  const booking = await payableBooking(payment.bookingId);
  const amounts = amountsFromBooking(booking);
  const driverId = payment.driverId as string;
  const current = (await ledgerRepository.findByDriver(driverId)) ?? emptyLedger(amounts.currency);
  const recognized = recognizePlatformCapture(current, amounts);
  await postRecognition(payment, amounts, recognized.balances, recognized.entries, recognized.feeStatus, "CUSTOMER_PLATFORM_PAYMENT");
  const updated = await paymentRepository.update(payment.id, { status: "SUCCESS" });
  await audit(undefined, "PAYMENT_CAPTURED", "Payment", payment.id, "Provider reported success");
  return paymentView(updated);
}

export async function payOutstandingFees(driverId: string, idempotencyKey: string) {
  const existing = await settlementRepository.findByIdempotency(driverId, idempotencyKey);
  if (existing) {
    return existing;
  }
  const fees = await platformFeeRepository.listForDriver(driverId);
  const plan = planOutstandingSettlement(fees);
  const provider = getPaymentProvider();
  const charge = await provider.createCharge({
    amountMinor: plan.amountMinor,
    currency: "INR",
    referenceId: driverId,
    idempotencyKey,
  });
  const settlement = await prisma.driverSettlement.create({
    data: {
      driverId,
      direction: "DRIVER_TO_PLATFORM",
      amountMinor: plan.amountMinor,
      currency: "INR",
      status: "PROCESSING",
      provider: charge.provider,
      providerRef: charge.providerRef,
      idempotencyKey,
      feeIds: plan.feeIds,
    },
  });
  await audit(driverId, "FEE_SETTLEMENT_STARTED", "DriverSettlement", settlement.id, "Driver started platform fee payment");
  return { ...settlement, checkoutUrl: charge.checkoutUrl ?? null };
}

async function applySettlementProviderEvent(settlementId: string, status: "SUCCESS" | "FAILED") {
  const settlement = await prisma.driverSettlement.findUnique({ where: { id: settlementId } });
  if (!settlement) {
    throw new AppError(404, "Settlement not found");
  }
  if (settlement.status === "COMPLETED" || settlement.status === "FAILED" || settlement.status === "CANCELLED") {
    return settlement;
  }
  if (status === "FAILED") {
    const updated = await prisma.driverSettlement.update({
      where: { id: settlement.id },
      data: { status: "FAILED" },
    });
    await audit(settlement.driverId, "FEE_SETTLEMENT_FAILED", "DriverSettlement", settlement.id, "Provider reported failure");
    return updated;
  }

  const current = (await ledgerRepository.findByDriver(settlement.driverId)) ?? emptyLedger(settlement.currency);
  const applied = applyFeeSettlement(current, settlement.amountMinor);
  await writeLedger(settlement.driverId, settlement.currency, applied.balances, applied.entries, settlement.feeIds[0] ?? "", settlement.id);
  await platformFeeRepository.markPaid(settlement.feeIds);
  await prisma.paymentTransaction.create({
    data: {
      settlementId: settlement.id,
      bookingId: settlement.feeIds[0] ?? settlement.id,
      type: "DRIVER_FEE_PAYMENT",
      amountMinor: settlement.amountMinor,
      currency: settlement.currency,
      provider: settlement.provider,
      providerRef: settlement.providerRef,
      status: "SUCCESS",
    },
  });
  const updated = await prisma.driverSettlement.update({
    where: { id: settlement.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await audit(settlement.driverId, "FEE_SETTLEMENT_COMPLETED", "DriverSettlement", settlement.id, "Outstanding platform fees paid");
  return updated;
}

export async function getWallet(driverId: string) {
  const ledger = (await ledgerRepository.findByDriver(driverId)) ?? emptyLedger();
  const fees = await platformFeeRepository.listForDriver(driverId);
  return {
    payableMinor: ledger.payableMinor,
    outstandingFeeMinor: ledger.outstandingFeeMinor,
    lifetimeEarningMinor: ledger.lifetimeEarningMinor,
    lifetimeDirectReceivedMinor: ledger.lifetimeDirectReceivedMinor,
    lifetimePlatformFeeMinor: ledger.lifetimePlatformFeeMinor,
    currency: ledger.currency,
    outstandingFromFeesMinor: sumOutstanding(fees),
  };
}

export async function getLedger(driverId: string, pageInput: number, limitInput: number) {
  const page = pagination(pageInput, limitInput);
  const result = await ledgerRepository.listEntries(driverId, page.skip, page.limit);
  return { items: result.items, pagination: paginationMeta(page.page, page.limit, result.total) };
}

export async function getDriverFees(driverId: string) {
  return platformFeeRepository.listForDriver(driverId);
}

export async function getDriverSettlements(driverId: string, pageInput: number, limitInput: number) {
  const page = pagination(pageInput, limitInput);
  const result = await settlementRepository.listForDriver(driverId, page.skip, page.limit);
  return { items: result.items, pagination: paginationMeta(page.page, page.limit, result.total) };
}

export async function adminPayments(pageInput: number, limitInput: number) {
  const page = pagination(pageInput, limitInput);
  const result = await paymentRepository.list(page.skip, page.limit);
  return { items: result.items.map(paymentView), pagination: paginationMeta(page.page, page.limit, result.total) };
}

export async function adminFees(pageInput: number, limitInput: number, outstandingOnly: boolean) {
  const page = pagination(pageInput, limitInput);
  const result = await platformFeeRepository.list(page.skip, page.limit, outstandingOnly ? { status: "DUE" } : {});
  return { items: result.items, pagination: paginationMeta(page.page, page.limit, result.total) };
}

export async function adminSettlements(pageInput: number, limitInput: number) {
  const page = pagination(pageInput, limitInput);
  const result = await settlementRepository.list(page.skip, page.limit);
  return { items: result.items, pagination: paginationMeta(page.page, page.limit, result.total) };
}

export async function adminDriverFinancials(driverId: string) {
  const wallet = await getWallet(driverId);
  const fees = await platformFeeRepository.listForDriver(driverId, "DUE");
  const settlements = await settlementRepository.listForDriver(driverId, 0, 20);
  return { driverId, wallet, outstandingFees: fees, recentSettlements: settlements.items };
}
