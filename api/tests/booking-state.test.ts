import { describe, expect, it } from "vitest";
import { canViewBooking } from "../src/services/booking.service.js";
import {
  ACTIVE_DRIVER_STATUSES,
  allowedTargets,
  assertTransition,
  canTransition,
} from "../src/services/booking-state-machine.js";
import { AppError } from "../src/utils/app-error.js";

const STATUSES = [
  "PENDING",
  "SEARCHING_DRIVER",
  "DRIVER_ASSIGNED",
  "DRIVER_ACCEPTED",
  "DRIVER_ON_THE_WAY",
  "DRIVER_ARRIVED",
  "TRIP_STARTED",
  "TRIP_COMPLETED",
  "CANCELLED_BY_USER",
  "CANCELLED_BY_DRIVER",
  "EXPIRED",
] as const;

describe("booking state machine", () => {
  it("allows the forward path through arrival", () => {
    expect(canTransition("PENDING", "SEARCHING_DRIVER")).toBe(true);
    expect(canTransition("SEARCHING_DRIVER", "DRIVER_ASSIGNED")).toBe(true);
    expect(canTransition("DRIVER_ASSIGNED", "DRIVER_ACCEPTED")).toBe(true);
    expect(canTransition("DRIVER_ACCEPTED", "DRIVER_ON_THE_WAY")).toBe(true);
    expect(canTransition("DRIVER_ON_THE_WAY", "DRIVER_ARRIVED")).toBe(true);
    expect(canTransition("DRIVER_ARRIVED", "TRIP_STARTED")).toBe(true);
    expect(canTransition("TRIP_STARTED", "TRIP_COMPLETED")).toBe(true);
  });

  it("allows reject to return a booking to search and no other backward edge", () => {
    expect(canTransition("DRIVER_ASSIGNED", "SEARCHING_DRIVER")).toBe(true);
    expect(canTransition("DRIVER_ACCEPTED", "SEARCHING_DRIVER")).toBe(false);
    expect(canTransition("DRIVER_ARRIVED", "DRIVER_ON_THE_WAY")).toBe(false);
  });

  it("rejects every transition that is not listed", () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        if (allowedTargets(from).includes(to)) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow(AppError);
        }
      }
    }
  });

  it("keeps terminal statuses closed", () => {
    for (const status of ["TRIP_COMPLETED", "CANCELLED_BY_USER", "CANCELLED_BY_DRIVER", "EXPIRED"] as const) {
      expect(allowedTargets(status)).toEqual([]);
    }
  });

  it("treats accepted through started as an active driver trip", () => {
    expect(ACTIVE_DRIVER_STATUSES).toEqual([
      "DRIVER_ACCEPTED",
      "DRIVER_ON_THE_WAY",
      "DRIVER_ARRIVED",
      "TRIP_STARTED",
    ]);
  });
});

describe("booking visibility", () => {
  const booking = { userId: "user-1", driverId: "driver-1" };

  it("allows the owner, the assigned driver, and an admin", () => {
    expect(canViewBooking({ id: "user-1", role: "USER" }, booking)).toBe(true);
    expect(canViewBooking({ id: "driver-1", role: "DRIVER" }, booking)).toBe(true);
    expect(canViewBooking({ id: "admin-1", role: "ADMIN" }, booking)).toBe(true);
  });

  it("hides the booking from other customers and unassigned drivers", () => {
    expect(canViewBooking({ id: "user-2", role: "USER" }, booking)).toBe(false);
    expect(canViewBooking({ id: "driver-2", role: "DRIVER" }, booking)).toBe(false);
    expect(canViewBooking({ id: "driver-2", role: "DRIVER" }, { userId: "user-1", driverId: null })).toBe(false);
  });
});
