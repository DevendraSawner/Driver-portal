import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../src/utils/jwt.js";

const users = vi.hoisted(() => new Map<string, { id: string; role: "USER" | "DRIVER" | "ADMIN"; status: "ACTIVE"; phone: string; email: null; fullName: string; deletedAt: null }>());

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    $runCommandRaw: vi.fn(),
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null),
    },
  },
}));

function token(role: "USER" | "DRIVER" | "ADMIN", id: string): string {
  users.set(id, {
    id,
    role,
    status: "ACTIVE",
    phone: "+919800000001",
    email: null,
    fullName: role,
    deletedAt: null,
  });
  return signAccessToken({ sub: id, role, sid: "session-1" });
}

describe("booking authorization", () => {
  beforeEach(() => {
    users.clear();
  });

  it("requires authentication", async () => {
    const { createApp } = await import("../src/app.js");
    const app = createApp();
    expect((await request(app).post("/api/v1/bookings").send({})).status).toBe(401);
    expect((await request(app).get("/api/v1/bookings")).status).toBe(401);
    expect((await request(app).get("/api/v1/driver/bookings/requests")).status).toBe(401);
  });

  it("lets only a customer create a booking and only a driver accept one", async () => {
    const { createApp } = await import("../src/app.js");
    const app = createApp();
    const customer = token("USER", "user-1");
    const driver = token("DRIVER", "driver-1");

    const createAsDriver = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${driver}`)
      .send({});
    expect(createAsDriver.status).toBe(403);

    const acceptAsCustomer = await request(app)
      .post("/api/v1/driver/bookings/aaaaaaaaaaaaaaaaaaaaaaaa/accept")
      .set("Authorization", `Bearer ${customer}`);
    expect(acceptAsCustomer.status).toBe(403);

    const requestsAsCustomer = await request(app)
      .get("/api/v1/driver/bookings/requests")
      .set("Authorization", `Bearer ${customer}`);
    expect(requestsAsCustomer.status).toBe(403);
  });
});
