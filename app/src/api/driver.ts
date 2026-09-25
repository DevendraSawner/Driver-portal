import { getData, patchData, postData } from "./client";
import type { Booking, DriverProfile, LedgerEntry, Page, PlatformFee, Settlement, Wallet } from "../types/models";

export function getDriverProfile() {
  return getData<DriverProfile>("/api/v1/driver/profile");
}

export function updateDriverProfile(body: { fullName?: string; city?: string; dateOfBirth?: string }) {
  return patchData<DriverProfile>("/api/v1/driver/profile", body);
}

export function submitKyc(documents: { type: string; fileKey: string; mimeType: string }[]) {
  return postData("/api/v1/driver/kyc", { documents });
}

export function getKycStatus() {
  return getData<{ kycStatus: string; kycRejectionReason: string | null; canReceiveBookings: boolean }>("/api/v1/driver/kyc/status");
}

export function setAvailability(online: boolean) {
  return postData<{ onlineStatus: "ONLINE" | "OFFLINE"; canReceiveBookings: boolean }>("/api/v1/driver/availability", { online });
}

export function listRequests() {
  return getData<Booking[]>("/api/v1/driver/bookings/requests");
}

export function acceptBooking(id: string) {
  return postData<Booking>(`/api/v1/driver/bookings/${id}/accept`);
}

export function rejectBooking(id: string, reason: string) {
  return postData<Booking>(`/api/v1/driver/bookings/${id}/reject`, { reason });
}

export function markEnRoute(id: string) {
  return postData<Booking>(`/api/v1/driver/bookings/${id}/en-route`);
}

export function markArrived(id: string) {
  return postData<Booking>(`/api/v1/driver/bookings/${id}/arrived`);
}

export function startTrip(id: string, otp: string) {
  return postData<Booking>(`/api/v1/driver/bookings/${id}/start`, { otp });
}

export function completeTrip(id: string) {
  return postData<Booking>(`/api/v1/driver/bookings/${id}/complete`);
}

export function confirmPayment(id: string) {
  return postData(`/api/v1/payments/${id}/confirm`);
}

export function getWallet() {
  return getData<Wallet>("/api/v1/driver/wallet");
}

export function getLedger(page = 1) {
  return getData<Page<LedgerEntry>>("/api/v1/driver/ledger", { page, limit: 20 });
}

export function getPlatformFees() {
  return getData<PlatformFee[]>("/api/v1/driver/platform-fees");
}

export function getSettlements(page = 1) {
  return getData<Page<Settlement>>("/api/v1/driver/settlements", { page, limit: 20 });
}

export function payPlatformFees(idempotencyKey: string) {
  return postData("/api/v1/driver/platform-fees/pay", {}, { "Idempotency-Key": idempotencyKey });
}
