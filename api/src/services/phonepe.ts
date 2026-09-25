import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import type { ChargeRequest, ChargeResult } from "./payment-provider.js";

const MIN_AMOUNT_MINOR = 100;

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function phonepeBase(): string {
  if (env.PHONEPE_ENV === "production") {
    return "https://api.phonepe.com/apis/pg";
  }
  return "https://api-preprod.phonepe.com/apis/pg-sandbox";
}

function tokenUrl(): string {
  if (env.PHONEPE_ENV === "production") {
    return "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
  }
  return "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
}

export function phonepeMerchantOrderId(referenceId: string, idempotencyKey: string): string {
  return `ord_${createHash("sha256").update(`${referenceId}:${idempotencyKey}`).digest("hex").slice(0, 40)}`;
}

export function phonepeAuthorization(username: string, password: string): string {
  return createHash("sha256").update(`${username}:${password}`).digest("hex");
}

export function phonepeWebhookMatches(presented: string | undefined): boolean {
  const username = env.PHONEPE_WEBHOOK_USERNAME;
  const password = env.PHONEPE_WEBHOOK_PASSWORD;
  if (!username || !password || !presented) {
    return false;
  }
  const expected = Buffer.from(phonepeAuthorization(username, password));
  const given = Buffer.from(presented.trim().toLowerCase());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function phonepeEventStatus(body: unknown): { orderId: string; status: "SUCCESS" | "FAILED" } {
  const payload = (body as { payload?: { orderId?: string; state?: string } } | null)?.payload;
  const orderId = payload?.orderId;
  const state = payload?.state;
  if (!orderId || (state !== "COMPLETED" && state !== "FAILED")) {
    throw new AppError(400, "PhonePe callback is missing order state");
  }
  return { orderId, status: state === "COMPLETED" ? "SUCCESS" : "FAILED" };
}

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - 60 > now) {
    return tokenCache.token;
  }
  const form = new URLSearchParams({
    client_id: env.PHONEPE_CLIENT_ID ?? "",
    client_version: env.PHONEPE_CLIENT_VERSION ?? "",
    client_secret: env.PHONEPE_CLIENT_SECRET ?? "",
    grant_type: "client_credentials",
  });
  const response = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!response.ok) {
    throw new AppError(502, "PhonePe authorization failed");
  }
  const json = (await response.json()) as { access_token?: string; expires_at?: number };
  if (!json.access_token || !json.expires_at) {
    throw new AppError(502, "PhonePe authorization failed");
  }
  tokenCache = { token: json.access_token, expiresAt: json.expires_at };
  return json.access_token;
}

export async function createPhonePeCharge(input: ChargeRequest): Promise<ChargeResult> {
  if (input.currency !== "INR") {
    throw new AppError(400, "PhonePe accepts INR only");
  }
  if (input.amountMinor < MIN_AMOUNT_MINOR) {
    throw new AppError(400, "PhonePe requires a minimum of 100 paise");
  }
  const token = await accessToken();
  const response = await fetch(`${phonepeBase()}/checkout/v2/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `O-Bearer ${token}`,
    },
    body: JSON.stringify({
      merchantOrderId: phonepeMerchantOrderId(input.referenceId, input.idempotencyKey),
      amount: input.amountMinor,
      paymentFlow: {
        type: "PG_CHECKOUT",
        merchantUrls: { redirectUrl: env.PHONEPE_REDIRECT_URL },
        paymentModeConfig: {
          version: "V2",
          enabledPaymentModes: [{ type: "UPI", flows: ["QR", "INTENT"] }],
        },
      },
    }),
  });
  if (!response.ok) {
    throw new AppError(502, "PhonePe could not start the payment");
  }
  const json = (await response.json()) as { orderId?: string; redirectUrl?: string; state?: string };
  if (!json.orderId || !json.redirectUrl || json.state !== "PENDING") {
    throw new AppError(502, "PhonePe could not start the payment");
  }
  return {
    provider: "phonepe",
    providerRef: json.orderId,
    status: "PROCESSING",
    checkoutUrl: json.redirectUrl,
  };
}
