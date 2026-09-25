import { getData } from "./client";
import { listBookings } from "./bookings";
import { listDrivers } from "./drivers";
import { listOutstandingFees, listPayments } from "./finance";
import type { BookingRecord, Page, PaymentRecord, PlatformFeeRecord } from "../types/models";

export type Metric = { state: "ready"; value: number } | { state: "unavailable"; reason: string };

async function collectPages<T>(load: (page: number) => Promise<Page<T>>): Promise<{ items: T[]; complete: boolean }> {
  const first = await load(1);
  const items = [...first.items];
  const pages = Math.min(first.pagination.totalPages, 10);
  for (let page = 2; page <= pages; page += 1) {
    const next = await load(page);
    items.push(...next.items);
  }
  return { items, complete: first.pagination.totalPages <= 10 };
}

function fromComplete(complete: boolean, value: number): Metric {
  if (!complete) {
    return { state: "unavailable", reason: "The API did not return the full list, so this total is not shown." };
  }
  return { state: "ready", value };
}

export async function loadDashboard() {
  const [usersResult, totalDrivers, activeDrivers, bookings, payments, outstanding] = await Promise.allSettled([
    getData<Page<unknown>>("/api/v1/admin/users", { page: 1, limit: 1 }),
    listDrivers({ page: 1, limit: 1 }),
    listDrivers({ page: 1, limit: 1, accountStatus: "ACTIVE" }),
    collectPages<BookingRecord>((page) => listBookings(page, 100)),
    collectPages<PaymentRecord>((page) => listPayments(page, 100)),
    collectPages<PlatformFeeRecord>((page) => listOutstandingFees(page, 100)),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const bookingValue = (pick: (items: BookingRecord[]) => number): Metric => {
    if (bookings.status === "rejected") {
      return { state: "unavailable", reason: "Bookings could not be loaded." };
    }
    return fromComplete(bookings.value.complete, pick(bookings.value.items));
  };

  return {
    totalUsers:
      usersResult.status === "fulfilled"
        ? ({ state: "ready", value: usersResult.value.pagination.total } as Metric)
        : ({ state: "unavailable", reason: "User list is not available from the API." } as Metric),
    totalDrivers:
      totalDrivers.status === "fulfilled"
        ? ({ state: "ready", value: totalDrivers.value.pagination.total } as Metric)
        : ({ state: "unavailable", reason: "Drivers could not be loaded." } as Metric),
    activeDrivers:
      activeDrivers.status === "fulfilled"
        ? ({ state: "ready", value: activeDrivers.value.pagination.total } as Metric)
        : ({ state: "unavailable", reason: "Drivers could not be loaded." } as Metric),
    todaysBookings: bookingValue((items) => items.filter((item) => item.createdAt.slice(0, 10) === today).length),
    completedTrips: bookingValue((items) => items.filter((item) => item.status === "TRIP_COMPLETED").length),
    cancelledTrips: bookingValue((items) => items.filter((item) => item.status.startsWith("CANCELLED")).length),
    grossBookingValue: bookingValue((items) => items.reduce((sum, item) => sum + item.estimatedFareMinor, 0)),
    platformRevenue: bookingValue((items) =>
      items.filter((item) => item.status === "TRIP_COMPLETED").reduce((sum, item) => sum + item.platformFeeMinor, 0),
    ),
    outstandingFees:
      outstanding.status === "fulfilled"
        ? fromComplete(
            outstanding.value.complete,
            outstanding.value.items.reduce((sum, item) => sum + item.amountMinor, 0),
          )
        : ({ state: "unavailable", reason: "Platform fees could not be loaded." } as Metric),
    directPaymentVolume:
      payments.status === "fulfilled"
        ? fromComplete(
            payments.value.complete,
            payments.value.items
              .filter((item) => item.rail === "DIRECT_PAYMENT" && item.status === "SUCCESS")
              .reduce((sum, item) => sum + item.amountMinor, 0),
          )
        : ({ state: "unavailable", reason: "Payments could not be loaded." } as Metric),
  };
}
