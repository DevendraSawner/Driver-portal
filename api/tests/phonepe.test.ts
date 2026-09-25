import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { phonepeAuthorization, phonepeEventStatus, phonepeMerchantOrderId } from "../src/services/phonepe.js";

describe("phonepe", () => {
  it("builds a merchant order id PhonePe will accept", () => {
    const id = phonepeMerchantOrderId("booking", "idem-key");
    expect(id).toMatch(/^ord_[a-f0-9]{40}$/);
    expect(id.length).toBeLessThanOrEqual(63);
  });

  it("hashes webhook credentials the way PhonePe sends them", () => {
    expect(phonepeAuthorization("user", "secret")).toBe(createHash("sha256").update("user:secret").digest("hex"));
  });

  it("reads completed and failed order state", () => {
    expect(phonepeEventStatus({ payload: { orderId: "OMO1", state: "COMPLETED" } })).toEqual({ orderId: "OMO1", status: "SUCCESS" });
    expect(phonepeEventStatus({ payload: { orderId: "OMO2", state: "FAILED" } })).toEqual({ orderId: "OMO2", status: "FAILED" });
    expect(() => phonepeEventStatus({ payload: { state: "PENDING" } })).toThrow(/order state/);
  });
});
