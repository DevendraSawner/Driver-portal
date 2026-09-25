import type { AccountStatus, DocumentType, KycStatus } from "@prisma/client";

const REQUIRED_KYC_TYPES = ["DRIVING_LICENSE", "IDENTITY_PROOF", "PROFILE_PHOTO"] as const satisfies readonly DocumentType[];

export function requiredKycTypes(): readonly DocumentType[] {
  return REQUIRED_KYC_TYPES;
}

export function canReceiveBookings(input: {
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
  deletedAt: Date | null;
}): boolean {
  return input.kycStatus === "APPROVED" && input.accountStatus === "ACTIVE" && input.deletedAt === null;
}

export function canSubmitKyc(status: KycStatus): boolean {
  return status === "PENDING" || status === "REJECTED";
}
