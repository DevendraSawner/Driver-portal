import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { createPhonePeCharge } from "./phonepe.js";

export type ChargeRequest = {
  amountMinor: number;
  currency: string;
  referenceId: string;
  idempotencyKey: string;
};

export type ChargeResult = {
  provider: string;
  providerRef: string;
  status: "PROCESSING";
  checkoutUrl?: string;
};

export interface PaymentProvider {
  readonly name: string;
  createCharge(input: ChargeRequest): Promise<ChargeResult>;
}

class PhonePePaymentProvider implements PaymentProvider {
  readonly name = "phonepe";

  createCharge(input: ChargeRequest): Promise<ChargeResult> {
    return createPhonePeCharge(input);
  }
}

class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox";

  async createCharge(input: ChargeRequest): Promise<ChargeResult> {
    const providerRef = `sandbox_${createHash("sha256").update(`${input.referenceId}:${input.idempotencyKey}`).digest("hex").slice(0, 24)}`;
    return { provider: this.name, providerRef, status: "PROCESSING" };
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === "sandbox") {
    return new SandboxPaymentProvider();
  }
  if (env.PAYMENT_PROVIDER === "phonepe") {
    return new PhonePePaymentProvider();
  }
  throw new Error(`Payment provider ${env.PAYMENT_PROVIDER} is not configured`);
}
