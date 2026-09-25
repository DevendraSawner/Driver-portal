import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";
import { bookingOfferRepository } from "../repositories/booking-offer.repository.js";
import { bookingRepository, type BookingView } from "../repositories/booking.repository.js";
import { driverProfileRepository } from "../repositories/driver-profile.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { vehicleRepository } from "../repositories/vehicle.repository.js";
import { AppError } from "../utils/app-error.js";
import { dayjs } from "../utils/dayjs.js";
import { pagination, paginationMeta } from "../utils/pagination.js";
import { splitEstimatedFare } from "./booking-pricing.js";
import { ACTIVE_DRIVER_STATUSES, OPEN_BOOKING_STATUSES } from "./booking-state-machine.js";
import { canReceiveBookings } from "./driver-eligibility.js";
import type { z } from "zod";
import type { createBookingSchema } from "../validators/booking.validator.js";

type CreateBookingInput = z.infer<typeof createBookingSchema>;

type Actor = { id: string; role: Role };

function referenceCode(): string {
  return `B${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function canViewBooking(actor: Actor, booking: { userId: string; driverId: string | null }): boolean {
  if (actor.role === "ADMIN") {
    return true;
  }
  if (actor.role === "USER") {
    return booking.userId === actor.id;
  }
  return booking.driverId === actor.id;
}

function publicBooking(booking: BookingView, actor: Actor) {
  const showCustomerPhone = actor.role === "ADMIN" || actor.id === booking.userId;
  const showDriverPhone = actor.role === "ADMIN" || actor.id === booking.driverId;
  return {
    id: booking.id,
    referenceCode: booking.referenceCode,
    type: booking.type,
    status: booking.status,
    user: {
      id: booking.user.id,
      fullName: booking.user.fullName,
      phone: showCustomerPhone ? booking.user.phone : undefined,
    },
    vehicle: booking.vehicle,
    driver: booking.driver
      ? {
          id: booking.driver.id,
          fullName: booking.driver.fullName,
          phone: showDriverPhone ? booking.driver.phone : undefined,
        }
      : null,
    pickup: { address: booking.pickupAddress, lat: booking.pickupLat, lng: booking.pickupLng },
    destination: {
      address: booking.destinationAddress,
      lat: booking.destinationLat,
      lng: booking.destinationLng,
    },
    scheduledAt: booking.scheduledAt,
    estimatedFareMinor: booking.estimatedFareMinor,
    platformFeeMinor: booking.platformFeeMinor,
    driverEarningMinor: booking.driverEarningMinor,
    currency: booking.currency,
    cancellation: booking.cancelledAt
      ? { at: booking.cancelledAt, reason: booking.cancellationReason, byUserId: booking.cancelledById }
      : null,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

async function expireIfNeeded(booking: BookingView): Promise<BookingView> {
  const now = dayjs();
  if (
    (booking.status === "SEARCHING_DRIVER" || booking.status === "DRIVER_ASSIGNED") &&
    booking.searchExpiresAt &&
    now.isAfter(booking.searchExpiresAt)
  ) {
    return bookingRepository.transition({
      id: booking.id,
      from: booking.status,
      to: "EXPIRED",
      actorRole: "ADMIN",
      reason: "Search timed out",
    });
  }
  if (booking.status === "PENDING" && now.isAfter(booking.scheduledAt)) {
    return bookingRepository.transition({
      id: booking.id,
      from: "PENDING",
      to: "EXPIRED",
      actorRole: "ADMIN",
      reason: "Scheduled time passed before search started",
    });
  }
  return booking;
}

async function offerNextDriver(booking: BookingView): Promise<BookingView> {
  if (booking.status !== "SEARCHING_DRIVER") {
    return booking;
  }
  const busy = await busyDriverIds();
  const rejected = await bookingOfferRepository.rejectedDriverIds(booking.id);
  const candidates = await driverProfileRepository.findOnlineApproved([...busy, ...rejected]);
  const driver = candidates[0];
  if (!driver) {
    return booking;
  }

  const expiresAt = dayjs().add(env.SEARCH_TIMEOUT_MINUTES, "minute").toDate();
  await bookingOfferRepository.create({
    bookingId: booking.id,
    driverId: driver.userId,
    expiresAt: booking.searchExpiresAt ?? expiresAt,
  });
  return bookingRepository.transition({
    id: booking.id,
    from: "SEARCHING_DRIVER",
    to: "DRIVER_ASSIGNED",
    driverId: driver.userId,
    actorRole: "ADMIN",
  });
}

async function busyDriverIds(): Promise<string[]> {
  return bookingRepository.busyDriverIds([...ACTIVE_DRIVER_STATUSES]);
}

async function promoteDueScheduled(): Promise<void> {
  const due = await bookingRepository.findDuePending(dayjs().add(env.SCHEDULED_SEARCH_LEAD_MINUTES, "minute").toDate());
  for (const booking of due) {
    if (dayjs().isAfter(booking.scheduledAt)) {
      await bookingRepository.transition({
        id: booking.id,
        from: "PENDING",
        to: "EXPIRED",
        reason: "Scheduled time passed before search started",
      });
      continue;
    }
    const searching = await bookingRepository.transition({
      id: booking.id,
      from: "PENDING",
      to: "SEARCHING_DRIVER",
      data: { searchExpiresAt: dayjs().add(env.SEARCH_TIMEOUT_MINUTES, "minute").toDate() },
      actorRole: "ADMIN",
    });
    await offerNextDriver(searching);
  }
}

export async function createBooking(userId: string, input: CreateBookingInput) {
  const vehicle = await vehicleRepository.findOwned(input.vehicleId, userId);
  if (!vehicle) {
    throw new AppError(404, "Vehicle not found");
  }

  const open = await bookingRepository.findOpenForUser(userId, [...OPEN_BOOKING_STATUSES]);
  if (open) {
    throw new AppError(409, "You already have an open booking");
  }

  const scheduledAt =
    input.type === "IMMEDIATE" ? new Date() : new Date(input.scheduledAt ?? "");
  if (input.type === "SCHEDULED") {
    const start = dayjs(scheduledAt);
    if (start.isBefore(dayjs())) {
      throw new AppError(422, "Scheduled time must be in the future");
    }
    if (start.isAfter(dayjs().add(env.SCHEDULE_MAX_DAYS, "day"))) {
      throw new AppError(422, "Scheduled time is too far ahead");
    }
  }

  const money = splitEstimatedFare(input.estimatedFareMinor);
  const searchNow =
    input.type === "IMMEDIATE" ||
    dayjs(scheduledAt).diff(dayjs(), "minute") <= env.SCHEDULED_SEARCH_LEAD_MINUTES;
  const initialStatus = searchNow ? "SEARCHING_DRIVER" : "PENDING";

  let booking = await bookingRepository.create(
    {
      referenceCode: referenceCode(),
      user: { connect: { id: userId } },
      vehicle: { connect: { id: vehicle.id } },
      type: input.type,
      status: initialStatus,
      pickupAddress: input.pickup.address,
      pickupLat: input.pickup.lat,
      pickupLng: input.pickup.lng,
      destinationAddress: input.destination.address,
      destinationLat: input.destination.lat,
      destinationLng: input.destination.lng,
      scheduledAt,
      estimatedFareMinor: money.estimatedFareMinor,
      platformFeeMinor: money.platformFeeMinor,
      driverEarningMinor: money.driverEarningMinor,
      currency: money.currency,
      feeBps: money.feeBps,
      searchExpiresAt: searchNow ? searchDeadline(scheduledAt, input.type) : null,
    },
    { actorUserId: userId, actorRole: "USER" },
  );

  if (booking.status === "SEARCHING_DRIVER") {
    booking = await offerNextDriver(booking);
  }

  return publicBooking(booking, { id: userId, role: "USER" });
}

export async function listBookings(actor: Actor, pageInput: number, limitInput: number) {
  const page = pagination(pageInput, limitInput);
  const result =
    actor.role === "ADMIN"
      ? await bookingRepository.listAll(page.skip, page.limit)
      : actor.role === "DRIVER"
        ? await bookingRepository.listForDriver(actor.id, page.skip, page.limit)
        : await bookingRepository.listForUser(actor.id, page.skip, page.limit);

  return {
    items: result.items.map((item) => publicBooking(item, actor)),
    pagination: paginationMeta(page.page, page.limit, result.total),
  };
}

export async function getBooking(actor: Actor, bookingId: string) {
  const found = await bookingRepository.findById(bookingId);
  if (!found || !canViewBooking(actor, found)) {
    throw new AppError(404, "Booking not found");
  }
  const booking = await expireIfNeeded(found);
  if (!canViewBooking(actor, booking)) {
    throw new AppError(404, "Booking not found");
  }
  return publicBooking(booking, actor);
}

export async function cancelBookingByUser(userId: string, bookingId: string, reason: string) {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking || booking.userId !== userId) {
    throw new AppError(404, "Booking not found");
  }
  const current = await expireIfNeeded(booking);
  const updated = await bookingRepository.transition({
    id: current.id,
    from: current.status,
    to: "CANCELLED_BY_USER",
    data: { cancelledAt: new Date(), cancellationReason: reason, cancelledById: userId },
    actorUserId: userId,
    actorRole: "USER",
    reason,
  });
  return publicBooking(updated, { id: userId, role: "USER" });
}

async function requireAssignedDriver(driverId: string, bookingId: string): Promise<BookingView> {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking || booking.driverId !== driverId) {
    throw new AppError(404, "Booking not found");
  }
  return expireIfNeeded(booking);
}

export async function acceptBooking(driverId: string, bookingId: string) {
  await assertDriverFree(driverId);
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) {
    throw new AppError(404, "Booking not found");
  }
  const offer = await bookingOfferRepository.findPending(bookingId, driverId);
  if (!offer || booking.status !== "DRIVER_ASSIGNED" || booking.driverId !== driverId) {
    throw new AppError(404, "Booking not found");
  }
  const current = await expireIfNeeded(booking);
  if (current.status !== "DRIVER_ASSIGNED") {
    throw new AppError(409, "This request is no longer available");
  }
  await bookingOfferRepository.close(offer.id, "ACCEPTED");
  const updated = await bookingRepository.transition({
    id: current.id,
    from: "DRIVER_ASSIGNED",
    to: "DRIVER_ACCEPTED",
    actorUserId: driverId,
    actorRole: "DRIVER",
  });
  return publicBooking(updated, { id: driverId, role: "DRIVER" });
}

export async function rejectBooking(driverId: string, bookingId: string, reason: string) {
  const booking = await bookingRepository.findById(bookingId);
  const offer = await bookingOfferRepository.findPending(bookingId, driverId);
  if (!booking || !offer || booking.driverId !== driverId || booking.status !== "DRIVER_ASSIGNED") {
    throw new AppError(404, "Booking not found");
  }
  await bookingOfferRepository.close(offer.id, "REJECTED");
  let updated = await bookingRepository.transition({
    id: booking.id,
    from: "DRIVER_ASSIGNED",
    to: "SEARCHING_DRIVER",
    driverId: null,
    actorUserId: driverId,
    actorRole: "DRIVER",
    reason,
  });
  updated = await offerNextDriver(updated);
  return publicBooking(updated, { id: driverId, role: "DRIVER" });
}

export async function markEnRoute(driverId: string, bookingId: string) {
  const booking = await requireAssignedDriver(driverId, bookingId);
  const updated = await bookingRepository.transition({
    id: booking.id,
    from: booking.status,
    to: "DRIVER_ON_THE_WAY",
    actorUserId: driverId,
    actorRole: "DRIVER",
  });
  return publicBooking(updated, { id: driverId, role: "DRIVER" });
}

export async function markArrived(driverId: string, bookingId: string) {
  const booking = await requireAssignedDriver(driverId, bookingId);
  const updated = await bookingRepository.transition({
    id: booking.id,
    from: booking.status,
    to: "DRIVER_ARRIVED",
    actorUserId: driverId,
    actorRole: "DRIVER",
  });
  return publicBooking(updated, { id: driverId, role: "DRIVER" });
}

export async function cancelBookingByDriver(driverId: string, bookingId: string, reason: string) {
  const booking = await requireAssignedDriver(driverId, bookingId);
  const updated = await bookingRepository.transition({
    id: booking.id,
    from: booking.status,
    to: "CANCELLED_BY_DRIVER",
    data: { cancelledAt: new Date(), cancellationReason: reason, cancelledById: driverId },
    actorUserId: driverId,
    actorRole: "DRIVER",
    reason,
  });
  return publicBooking(updated, { id: driverId, role: "DRIVER" });
}

function searchDeadline(scheduledAt: Date, type: "IMMEDIATE" | "SCHEDULED"): Date {
  const timeoutAt = dayjs().add(env.SEARCH_TIMEOUT_MINUTES, "minute");
  if (type === "SCHEDULED" && dayjs(scheduledAt).isBefore(timeoutAt)) {
    return scheduledAt;
  }
  return timeoutAt.toDate();
}

export async function listDriverRequests(driverId: string) {
  await promoteDueScheduled();
  await assertDriverFree(driverId);
  const offers = await bookingOfferRepository.listPendingForDriver(driverId);
  const items = [];
  for (const offer of offers) {
    const booking = await bookingRepository.findById(offer.bookingId);
    if (!booking || booking.status !== "DRIVER_ASSIGNED" || booking.driverId !== driverId) {
      continue;
    }
    items.push(publicBooking(booking, { id: driverId, role: "DRIVER" }));
  }
  return items;
}

async function assertDriverFree(driverId: string): Promise<void> {
  const profile = await driverProfileRepository.findByUserId(driverId);
  const user = profile ? await userRepository.findById(driverId) : null;
  if (!profile || !user || profile.deletedAt || profile.onlineStatus !== "ONLINE" || !canReceiveBookings({
    kycStatus: profile.kycStatus,
    accountStatus: user.status,
    deletedAt: user.deletedAt,
  })) {
    throw new AppError(403, "You must be an approved, active, online driver to take requests");
  }
  const active = await bookingRepository.findActiveForDriver(driverId, [...ACTIVE_DRIVER_STATUSES]);
  if (active) {
    throw new AppError(409, "You already have an active trip");
  }
}
