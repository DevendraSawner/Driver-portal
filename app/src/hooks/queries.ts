import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as authApi from "../api/auth";
import * as driverApi from "../api/driver";
import * as userApi from "../api/user";
import { OPEN_BOOKING_STATUSES } from "../constants/config";
import type { Booking } from "../types/models";

export function useVehicles() {
  return useQuery({ queryKey: ["vehicles"], queryFn: userApi.listVehicles });
}

export function useCreateVehicle() {
  const client = useQueryClient();
  return useMutation({ mutationFn: userApi.createVehicle, onSuccess: () => client.invalidateQueries({ queryKey: ["vehicles"] }) });
}

export function useBookings() {
  return useQuery({ queryKey: ["bookings"], queryFn: () => userApi.listBookings(1) });
}

export function useBooking(id: string) {
  return useQuery({ queryKey: ["booking", id], queryFn: () => userApi.getBooking(id), enabled: Boolean(id) });
}

export function activeBooking(items: Booking[] | undefined): Booking | undefined {
  return items?.find((item) => (OPEN_BOOKING_STATUSES as readonly string[]).includes(item.status));
}

export function useCreateBooking() {
  const client = useQueryClient();
  return useMutation({ mutationFn: userApi.createBooking, onSuccess: () => client.invalidateQueries({ queryKey: ["bookings"] }) });
}

export function useCancelBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => userApi.cancelBooking(id, reason),
    onSuccess: () => client.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useDriverProfile() {
  return useQuery({ queryKey: ["driver-profile"], queryFn: driverApi.getDriverProfile });
}

export function useKycStatus() {
  return useQuery({ queryKey: ["kyc-status"], queryFn: driverApi.getKycStatus });
}

export function useAvailability() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: driverApi.setAvailability,
    onSuccess: () => client.invalidateQueries({ queryKey: ["driver-profile"] }),
  });
}

export function useRequests() {
  return useQuery({ queryKey: ["requests"], queryFn: driverApi.listRequests });
}

export function useWallet() {
  return useQuery({ queryKey: ["wallet"], queryFn: driverApi.getWallet });
}

export function useLedger() {
  return useQuery({ queryKey: ["ledger"], queryFn: () => driverApi.getLedger(1) });
}

export function useFees() {
  return useQuery({ queryKey: ["fees"], queryFn: driverApi.getPlatformFees });
}

export function useSettlements() {
  return useQuery({ queryKey: ["settlements"], queryFn: () => driverApi.getSettlements(1) });
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: userApi.getMe });
}

export function useVerifyOtp() {
  return useMutation({ mutationFn: authApi.verifyOtp });
}

export function useResendOtp() {
  return useMutation({ mutationFn: ({ phone, purpose }: { phone: string; purpose: "REGISTER" | "PASSWORD_RESET" }) => authApi.resendOtp(phone, purpose) });
}

export function useUpdateMe() {
  const client = useQueryClient();
  return useMutation({ mutationFn: userApi.updateMe, onSuccess: () => client.invalidateQueries({ queryKey: ["me"] }) });
}

export function useBookingLocation(id: string, enabled: boolean) {
  return useQuery({ queryKey: ["booking-location", id], queryFn: () => userApi.getBookingLocation(id), enabled, refetchInterval: enabled ? 10000 : false });
}

export function usePayment(id: string) {
  return useQuery({ queryKey: ["payment", id], queryFn: () => userApi.getPayment(id), enabled: Boolean(id) });
}

export function useStartPlatformPayment() {
  return useMutation({ mutationFn: ({ bookingId, idempotencyKey }: { bookingId: string; idempotencyKey: string }) => userApi.startPlatformPayment(bookingId, idempotencyKey) });
}

export function useDeclareDirectPayment() {
  return useMutation({
    mutationFn: ({ bookingId, idempotencyKey }: { bookingId: string; idempotencyKey: string }) => userApi.declareDirectPayment(bookingId, "UPI", idempotencyKey),
  });
}

export function useNotifications() {
  return useQuery({ queryKey: ["notifications"], queryFn: userApi.listNotifications, retry: false });
}

export function useCreateComplaint() {
  return useMutation({ mutationFn: userApi.createComplaint });
}

export function useCreateRating() {
  return useMutation({ mutationFn: ({ bookingId, score }: { bookingId: string; score: number }) => userApi.createRating(bookingId, score) });
}

export function useUpdateDriverProfile() {
  return useMutation({ mutationFn: driverApi.updateDriverProfile });
}

export function useSubmitKyc() {
  return useMutation({ mutationFn: driverApi.submitKyc });
}

export function useAcceptBooking() {
  const client = useQueryClient();
  return useMutation({ mutationFn: driverApi.acceptBooking, onSuccess: () => client.invalidateQueries({ queryKey: ["requests"] }) });
}

export function useRejectBooking() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => driverApi.rejectBooking(id, reason), onSuccess: () => client.invalidateQueries({ queryKey: ["requests"] }) });
}

export function useMarkEnRoute() {
  return useMutation({ mutationFn: driverApi.markEnRoute });
}

export function useMarkArrived() {
  return useMutation({ mutationFn: driverApi.markArrived });
}

export function useStartTrip() {
  return useMutation({ mutationFn: ({ id, otp }: { id: string; otp: string }) => driverApi.startTrip(id, otp) });
}

export function useCompleteTrip() {
  return useMutation({ mutationFn: driverApi.completeTrip });
}

export function useConfirmPayment() {
  return useMutation({ mutationFn: driverApi.confirmPayment });
}

export function usePayFees() {
  const client = useQueryClient();
  return useMutation({ mutationFn: driverApi.payPlatformFees, onSuccess: () => client.invalidateQueries({ queryKey: ["fees"] }) });
}
