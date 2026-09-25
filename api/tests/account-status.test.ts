import { describe, expect, it } from "vitest";
import { assertAccountCanAuthenticate } from "../src/utils/account-status.js";
import { AppError } from "../src/utils/app-error.js";

describe("assertAccountCanAuthenticate", () => {
  it("allows active accounts", () => {
    expect(() => assertAccountCanAuthenticate("ACTIVE")).not.toThrow();
  });

  it.each([
    ["PENDING_VERIFICATION", 403],
    ["INACTIVE", 403],
    ["SUSPENDED", 403],
    ["BLOCKED", 403],
  ] as const)("rejects %s", (status, code) => {
    expect(() => assertAccountCanAuthenticate(status)).toThrow(AppError);
    try {
      assertAccountCanAuthenticate(status);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(code);
    }
  });
});
