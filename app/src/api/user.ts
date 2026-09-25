import { getData, patchData, postData } from "./client";
import type { Account, Booking, Page, Payment, Vehicle } from "../types/models";

export function getMe() {
  return getData<Account>("/api/v1/users/me");
}

export function updateMe(body: { fullName?: string; city?: string; emergencyContactName?: string; emergencyContactPhone?: string }) {
  return patchData<Account>("/api/v1/users/me", body);
}

export function listVehicles() {
  return getData<Vehicle[]>("/api/v1/vehicles");
}

export function createVehicle(body: Omit<Vehicle, "id" | "color"> & { color?: string }) {
  return postData<Vehicle>("/api/v1/vehicles", body);
}

export function listBookings(page = 1) {
  return getData<Page<Booking>>("/api/v1/bookings", { page, limit: 20 });
}

export function getBooking(id: string) {
  return getData<Booking>(`/api/v1/bookings/${id}`);
}

export function createBooking(body: {
  vehicleId: string;
  type: "IMMEDIATE" | "SCHEDULED";
  scheduledAt?: string;
  pickup: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  estimatedFareMinor: number;
}) {
  return postData<Booking>("/api/v1/bookings", body);
}

export function cancelBooking(id: string, reason: string) {
  return postData<Booking>(`/api/v1/bookings/${id}/cancel`, { reason });
}

export function getBookingLocation(id: string) {
  return getData<{ lat: number; lng: number; recordedAt: string }>(`/api/v1/bookings/${id}/location`);
}

export function startPlatformPayment(bookingId: string, idempotencyKey: string) {
  return postData<Payment>("/api/v1/payments", { bookingId }, { "Idempotency-Key": idempotencyKey });
}

export function declareDirectPayment(bookingId: string, method: "CASH" | "UPI" | "BANK_TRANSFER", idempotencyKey: string, reference?: string) {
  return postData<Payment>("/api/v1/payments/direct", { bookingId, method, reference }, { "Idempotency-Key": idempotencyKey });
}

export function getPayment(id: string) {
  return getData<Payment>(`/api/v1/payments/${id}`);
}

export function listNotifications() {
  return getData<Page<{ id: string; title: string; body: string; createdAt: string }>>("/api/v1/notifications");
}

export function createComplaint(body: { bookingId?: string; subject: string; body: string }) {
  return postData("/api/v1/complaints", body);
}

export function createRating(bookingId: string, score: number, review?: string) {
  return postData(`/api/v1/bookings/${bookingId}/rating`, { score, review });
}
