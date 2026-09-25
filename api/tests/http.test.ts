import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ping = vi.fn();

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    $runCommandRaw: (...args: unknown[]) => ping(...args),
    user: { findUnique: vi.fn() },
  },
}));

describe("GET /api/v1/health", () => {
  beforeEach(() => {
    ping.mockReset();
  });

  it("reports the database as up", async () => {
    ping.mockResolvedValue({ ok: 1 });
    const { createApp } = await import("../src/app.js");
    const response = await request(createApp()).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "OK",
      data: { database: "up" },
    });
  });

  it("returns 503 when the database is unreachable", async () => {
    ping.mockRejectedValue(new Error("down"));
    const { createApp } = await import("../src/app.js");
    const response = await request(createApp()).get("/api/v1/health");
    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
  });
});

describe("POST /api/v1/auth/register", () => {
  it("rejects an invalid body before any account is created", async () => {
    const { createApp } = await import("../src/app.js");
    const response = await request(createApp()).post("/api/v1/auth/register").send({
      role: "ADMIN",
      phone: "123",
      password: "short",
      fullName: "A",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });
});

describe("GET /api/v1/admin/me", () => {
  it("requires authentication", async () => {
    const { createApp } = await import("../src/app.js");
    const response = await request(createApp()).get("/api/v1/admin/me");
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

describe("profile, vehicle, and driver routes", () => {
  it("requires authentication", async () => {
    const { createApp } = await import("../src/app.js");
    const app = createApp();
    const paths = [
      ["get", "/api/v1/users/me"],
      ["patch", "/api/v1/users/me"],
      ["get", "/api/v1/vehicles"],
      ["post", "/api/v1/vehicles"],
      ["get", "/api/v1/driver/profile"],
      ["get", "/api/v1/driver/kyc"],
      ["get", "/api/v1/driver/kyc/status"],
      ["get", "/api/v1/admin/drivers"],
    ] as const;

    for (const [method, path] of paths) {
      const response = await request(app)[method](path);
      expect(response.status).toBe(401);
    }
  });
});
