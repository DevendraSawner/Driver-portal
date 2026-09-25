import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/utils/password.js";

describe("password hashing", () => {
  it("verifies the original password and rejects a different one", async () => {
    const hash = await hashPassword("Driver123");
    expect(hash).not.toContain("Driver123");
    expect(await verifyPassword("Driver123", hash)).toBe(true);
    expect(await verifyPassword("Driver124", hash)).toBe(false);
  });
});
