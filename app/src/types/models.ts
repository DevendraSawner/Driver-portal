export type ApiSuccess<T> = { success: true; message: string; data: T };
export type ApiFailure = { success: false; message: string; errors: { field?: string; message: string }[] };

export type Role = "USER" | "DRIVER" | "ADMIN";

export type Account = {
  id: string;
  role: Role;
  phone: string;
  email: string | null;
  fullName: string;
  status: string;
  profile?: {
    avatarUrl: string | null;
    city: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  } | null;
};

export type Vehicle = {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  brand: string;
  model: string;
  transmission: string;
  fuelType: string;
  color: string | null;
};

export type Booking = {
  id: string;
  referenceCode: string;
  type: "IMMEDIATE" | "SCHEDULED";
  status: string;
  user: { id: string; fullName: string; phone?: string };
  driver: { id: string; fullName: string; phone?: string } | null;
  vehicle: { id: string; registrationNumber: string; brand: string; model: string; vehicleType: string };
  pickup: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  scheduledAt: string;
  estimatedFareMinor: number;
  platformFeeMinor: number;
  driverEarningMinor: number;
  currency: string;
  cancellation: { at: string; reason: string | null } | null;
  createdAt: string;
};

export type Payment = {
  id: string;
  bookingId: string;
  rail: "PLATFORM_PAYMENT" | "DIRECT_PAYMENT";
  receiver: string;
  directMethod: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  directConfirmStatus: string | null;
  customerReference: string | null;
  providerRef: string | null;
  checkoutUrl?: string | null;
};

export type Wallet = {
  payableMinor: number;
  outstandingFeeMinor: number;
  lifetimeEarningMinor: number;
  lifetimeDirectReceivedMinor: number;
  lifetimePlatformFeeMinor: number;
  currency: string;
};

export type LedgerEntry = {
  id: string;
  account: string;
  direction: string;
  amountMinor: number;
  currency: string;
  memo: string;
  createdAt: string;
};

export type PlatformFee = {
  id: string;
  bookingId: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type Settlement = {
  id: string;
  direction: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type DriverProfile = {
  id: string;
  fullName: string;
  city: string | null;
  kycStatus: string;
  kycRejectionReason: string | null;
  onlineStatus: "ONLINE" | "OFFLINE";
  canReceiveBookings: boolean;
};

export type Page<T> = { items: T[]; pagination: { page: number; total: number; totalPages: number } };
