import { getData } from "./client";
import type { BookingRecord, Page } from "../types/models";

export function listBookings(page: number, limit = 20): Promise<Page<BookingRecord>> {
  return getData<Page<BookingRecord>>("/api/v1/bookings", { page, limit });
}

export function getBooking(id: string): Promise<BookingRecord> {
  return getData<BookingRecord>(`/api/v1/bookings/${id}`);
}
