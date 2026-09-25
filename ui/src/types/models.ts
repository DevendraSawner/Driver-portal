export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  message: string;
  errors: { field?: string; message: string; code?: string }[];
};

export type Account = {
  id: string;
  role: "ADMIN" | "DRIVER" | "USER";
  phone: string;
  email: string | null;
  fullName: string;
  status: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Page<T> = {
  items: T[];
  pagination: Pagination;
};

export type AccountStatus = "PENDING_VERIFICATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED";
export type KycStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

export type DriverDocument = {
  id: string;
  type: string;
  fileKey: string;
  mimeType: string;
  status: string;
  reviewNote: string | null;
  createdAt: string;
};

export type DriverRecord = {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string | null;
  city: string | null;
  kycStatus: KycStatus;
  kycRejectionReason: string | null;
  onlineStatus: "ONLINE" | "OFFLINE";
  accountStatus: AccountStatus;
  canReceiveBookings: boolean;
  approvedAt: string | null;
  createdAt: string;
  documents?: DriverDocument[];
};

export type BookingRecord = {
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
  cancellation: { at: string; reason: string | null; byUserId: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentRecord = {
  id: string;
  bookingId: string;
  rail: "PLATFORM_PAYMENT" | "DIRECT_PAYMENT";
  receiver: "PLATFORM" | "DRIVER";
  directMethod: "CASH" | "UPI" | "BANK_TRANSFER" | null;
  amountMinor: number;
  currency: string;
  status: string;
  directConfirmStatus: string | null;
  customerReference: string | null;
  provider: string | null;
  providerRef: string | null;
  createdAt: string;
};

export type PlatformFeeRecord = {
  id: string;
  bookingId: string;
  paymentId: string;
  driverId: string;
  amountMinor: number;
  currency: string;
  status: "PENDING" | "DUE" | "PAID" | "WAIVED" | "REFUNDED";
  createdAt: string;
  updatedAt: string;
};

export type SettlementRecord = {
  id: string;
  driverId: string;
  direction: "PLATFORM_TO_DRIVER" | "DRIVER_TO_PLATFORM";
  amountMinor: number;
  currency: string;
  status: string;
  providerRef: string | null;
  feeIds: string[];
  createdAt: string;
  completedAt: string | null;
};

export type DriverFinancials = {
  driverId: string;
  wallet: {
    payableMinor: number;
    outstandingFeeMinor: number;
    lifetimeEarningMinor: number;
    lifetimeDirectReceivedMinor: number;
    lifetimePlatformFeeMinor: number;
    currency: string;
    outstandingFromFeesMinor: number;
  };
  outstandingFees: PlatformFeeRecord[];
  recentSettlements: SettlementRecord[];
};
