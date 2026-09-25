import type { BookingStatus } from "@prisma/client";
import { AppError } from "../utils/app-error.js";

const EDGES: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: ["SEARCHING_DRIVER", "CANCELLED_BY_USER", "EXPIRED"],
  SEARCHING_DRIVER: ["DRIVER_ASSIGNED", "CANCELLED_BY_USER", "EXPIRED"],
  DRIVER_ASSIGNED: ["DRIVER_ACCEPTED", "SEARCHING_DRIVER", "CANCELLED_BY_USER", "EXPIRED"],
  DRIVER_ACCEPTED: ["DRIVER_ON_THE_WAY", "CANCELLED_BY_USER", "CANCELLED_BY_DRIVER"],
  DRIVER_ON_THE_WAY: ["DRIVER_ARRIVED", "CANCELLED_BY_USER", "CANCELLED_BY_DRIVER"],
  DRIVER_ARRIVED: ["TRIP_STARTED", "CANCELLED_BY_USER", "CANCELLED_BY_DRIVER"],
  TRIP_STARTED: ["TRIP_COMPLETED"],
  TRIP_COMPLETED: [],
  CANCELLED_BY_USER: [],
  CANCELLED_BY_DRIVER: [],
  EXPIRED: [],
};

export const ACTIVE_DRIVER_STATUSES = [
  "DRIVER_ACCEPTED",
  "DRIVER_ON_THE_WAY",
  "DRIVER_ARRIVED",
  "TRIP_STARTED",
] as const satisfies readonly BookingStatus[];

export const OPEN_BOOKING_STATUSES = [
  "PENDING",
  "SEARCHING_DRIVER",
  "DRIVER_ASSIGNED",
  "DRIVER_ACCEPTED",
  "DRIVER_ON_THE_WAY",
  "DRIVER_ARRIVED",
  "TRIP_STARTED",
] as const satisfies readonly BookingStatus[];

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return EDGES[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(409, `Cannot change a booking from ${from} to ${to}`);
  }
}

export function allowedTargets(from: BookingStatus): readonly BookingStatus[] {
  return EDGES[from];
}
