import type { Request, Response } from "express";
import {
  adminDriverFinancials,
  adminFees,
  adminPayments,
  adminSettlements,
  applyProviderEvent,
  assertWebhookSecret,
  confirmDirectPayment,
  createDirectPayment,
  createPlatformPayment,
  getDriverFees,
  getDriverSettlements,
  getLedger,
  getPaymentForActor,
  getWallet,
  payOutstandingFees,
} from "../services/payment.service.js";
import { phonepeEventStatus, phonepeWebhookMatches } from "../services/phonepe.js";
import { AppError } from "../utils/app-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

function actor(req: Request) {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  return req.authUser;
}

function idempotencyKey(req: Request): string {
  const key = req.header("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 80) {
    throw new AppError(400, "Idempotency-Key header is required");
  }
  return key;
}

function pageQuery(req: Request): { page: number; limit: number } {
  return req.query as unknown as { page: number; limit: number };
}

export const postPayment = asyncHandler(async (req: Request, res: Response) => {
  const current = actor(req);
  sendSuccess(res, "Payment started", await createPlatformPayment(current.id, req.body.bookingId, idempotencyKey(req)), 201);
});

export const postDirectPayment = asyncHandler(async (req: Request, res: Response) => {
  const current = actor(req);
  sendSuccess(
    res,
    "Direct payment recorded",
    await createDirectPayment(current.id, req.body, idempotencyKey(req)),
    201,
  );
});

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const current = actor(req);
  sendSuccess(res, "OK", await getPaymentForActor(current, String(req.params.id)));
});

export const postConfirmPayment = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Payment confirmed", await confirmDirectPayment(actor(req).id, String(req.params.id)));
});

export const postWebhook = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.provider === "phonepe") {
    if (!phonepeWebhookMatches(req.header("authorization"))) {
      throw new AppError(401, "Invalid webhook secret");
    }
    const event = phonepeEventStatus(req.body);
    sendSuccess(res, "Provider event applied", await applyProviderEvent(event.orderId, event.status));
    return;
  }
  if (req.params.provider !== "sandbox") {
    throw new AppError(404, "Payment provider not found");
  }
  assertWebhookSecret(req.header("x-payment-webhook-secret"));
  sendSuccess(res, "Provider event applied", await applyProviderEvent(req.body.providerRef, req.body.status));
});

export const getDriverWallet = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await getWallet(actor(req).id));
});

export const getDriverLedger = asyncHandler(async (req: Request, res: Response) => {
  const query = pageQuery(req);
  sendSuccess(res, "OK", await getLedger(actor(req).id, query.page, query.limit));
});

export const getDriverPlatformFees = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await getDriverFees(actor(req).id));
});

export const getDriverSettlementList = asyncHandler(async (req: Request, res: Response) => {
  const query = pageQuery(req);
  sendSuccess(res, "OK", await getDriverSettlements(actor(req).id, query.page, query.limit));
});

export const postPayPlatformFees = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "Platform fee payment started", await payOutstandingFees(actor(req).id, idempotencyKey(req)), 201);
});

export const getAdminPayments = asyncHandler(async (req: Request, res: Response) => {
  const query = pageQuery(req);
  sendSuccess(res, "OK", await adminPayments(query.page, query.limit));
});

export const getAdminFees = asyncHandler(async (req: Request, res: Response) => {
  const query = pageQuery(req);
  sendSuccess(res, "OK", await adminFees(query.page, query.limit, false));
});

export const getAdminOutstandingFees = asyncHandler(async (req: Request, res: Response) => {
  const query = pageQuery(req);
  sendSuccess(res, "OK", await adminFees(query.page, query.limit, true));
});

export const getAdminSettlements = asyncHandler(async (req: Request, res: Response) => {
  const query = pageQuery(req);
  sendSuccess(res, "OK", await adminSettlements(query.page, query.limit));
});

export const getAdminDriverFinancials = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, "OK", await adminDriverFinancials(String(req.params.driverId)));
});
