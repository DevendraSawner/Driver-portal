import type { DriverDocument, DriverProfile } from "@prisma/client";
import { driverDocumentRepository } from "../repositories/driver-document.repository.js";
import { driverProfileRepository, type DriverListRow } from "../repositories/driver-profile.repository.js";
import { refreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/app-error.js";
import { pagination, paginationMeta } from "../utils/pagination.js";
import { hashPassword } from "../utils/password.js";
import { canReceiveBookings, canSubmitKyc, requiredKycTypes } from "./driver-eligibility.js";
import type { z } from "zod";
import type { createDriverSchema, submitKycSchema, updateDriverProfileSchema } from "../validators/driver.validator.js";

type UpdateDriverInput = z.infer<typeof updateDriverProfileSchema>;
type SubmitKycInput = z.infer<typeof submitKycSchema>;
type CreateDriverInput = z.infer<typeof createDriverSchema>;

function documentView(document: DriverDocument) {
  return {
    id: document.id,
    type: document.type,
    fileKey: document.fileKey,
    mimeType: document.mimeType,
    status: document.status,
    reviewNote: document.reviewNote,
    createdAt: document.createdAt,
  };
}

function profileView(profile: DriverProfile, accountStatus: DriverListRow["user"]["status"] | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED" | "PENDING_VERIFICATION", deletedAt: Date | null) {
  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    dateOfBirth: profile.dateOfBirth,
    city: profile.city,
    kycStatus: profile.kycStatus,
    kycReviewedAt: profile.kycReviewedAt,
    kycRejectionReason: profile.kycRejectionReason,
    onlineStatus: profile.onlineStatus,
    approvedAt: profile.approvedAt,
    canReceiveBookings: canReceiveBookings({
      kycStatus: profile.kycStatus,
      accountStatus,
      deletedAt,
    }),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

async function requireDriverUser(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user || user.deletedAt || user.role !== "DRIVER") {
    throw new AppError(403, "Driver access is required");
  }
  return user;
}

async function ensureDriverProfile(userId: string, fullName: string) {
  const existing = await driverProfileRepository.findByUserId(userId);
  if (existing && !existing.deletedAt) {
    return existing;
  }
  return driverProfileRepository.create({
    user: { connect: { id: userId } },
    fullName,
    kycStatus: "PENDING",
    onlineStatus: "OFFLINE",
  });
}

export async function getDriverProfile(userId: string) {
  const user = await requireDriverUser(userId);
  const profile = await ensureDriverProfile(user.id, user.fullName);
  return profileView(profile, user.status, user.deletedAt);
}

export async function updateDriverProfile(userId: string, input: UpdateDriverInput) {
  const user = await requireDriverUser(userId);
  const profile = await ensureDriverProfile(user.id, user.fullName);

  if (input.fullName && input.fullName !== user.fullName) {
    await userRepository.update(user.id, { fullName: input.fullName });
  }

  const updated = await driverProfileRepository.update(profile.id, {
    ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null } : {}),
  });

  return profileView(updated, user.status, user.deletedAt);
}

export async function submitKyc(userId: string, input: SubmitKycInput) {
  const user = await requireDriverUser(userId);
  const profile = await ensureDriverProfile(user.id, user.fullName);

  if (!canSubmitKyc(profile.kycStatus)) {
    throw new AppError(409, "KYC cannot be submitted in the current state");
  }

  const types = new Set(input.documents.map((document) => document.type));
  const missing = requiredKycTypes().filter((type) => !types.has(type));
  if (missing.length > 0) {
    throw new AppError(422, "Required KYC documents are missing", [
      { field: "documents", message: `Missing ${missing.join(", ")}` },
    ]);
  }

  for (const document of input.documents) {
    await driverDocumentRepository.supersede(profile.id, document.type);
  }

  await driverDocumentRepository.createMany(
    input.documents.map((document) => ({
      driverProfileId: profile.id,
      type: document.type,
      fileKey: document.fileKey,
      mimeType: document.mimeType,
    })),
  );

  const updated = await driverProfileRepository.update(profile.id, {
    kycStatus: "UNDER_REVIEW",
    kycRejectionReason: null,
  });

  const documents = await driverDocumentRepository.listByProfile(profile.id);
  return {
    ...profileView(updated, user.status, user.deletedAt),
    documents: documents.map(documentView),
  };
}

export async function getDriverKyc(userId: string) {
  const user = await requireDriverUser(userId);
  const profile = await ensureDriverProfile(user.id, user.fullName);
  const documents = await driverDocumentRepository.listByProfile(profile.id);
  return {
    ...profileView(profile, user.status, user.deletedAt),
    documents: documents.map(documentView),
  };
}

export async function getDriverKycStatus(userId: string) {
  const profile = await getDriverProfile(userId);
  return {
    kycStatus: profile.kycStatus,
    kycRejectionReason: profile.kycRejectionReason,
    canReceiveBookings: profile.canReceiveBookings,
  };
}

function adminDriverView(row: DriverListRow) {
  return {
    ...profileView(row, row.user.status, row.user.deletedAt),
    phone: row.user.phone,
    email: row.user.email,
    accountStatus: row.user.status,
  };
}

export async function listDrivers(query: {
  page: number;
  limit: number;
  search?: string;
  kycStatus?: DriverListRow["kycStatus"];
  accountStatus?: DriverListRow["user"]["status"];
}) {
  const page = pagination(query.page, query.limit);
  const result = await driverProfileRepository.list({
    skip: page.skip,
    take: page.limit,
    search: query.search,
    kycStatus: query.kycStatus,
    accountStatus: query.accountStatus,
  });

  return {
    items: result.items.map(adminDriverView),
    pagination: paginationMeta(page.page, page.limit, result.total),
  };
}

export async function createDriverByAdmin(input: CreateDriverInput) {
  const existingPhone = await userRepository.findByPhone(input.phone);
  if (existingPhone && !existingPhone.deletedAt) {
    throw new AppError(409, "An account with this phone already exists");
  }
  if (input.email) {
    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail && !existingEmail.deletedAt) {
      throw new AppError(409, "An account with this email already exists");
    }
  }

  const user = await userRepository.create({
    role: "DRIVER",
    phone: input.phone,
    ...(input.email ? { email: input.email } : {}),
    fullName: input.fullName,
    passwordHash: await hashPassword(input.password),
    status: "ACTIVE",
    phoneVerifiedAt: new Date(),
  });

  const profile = await driverProfileRepository.create({
    user: { connect: { id: user.id } },
    fullName: input.fullName,
    city: input.city ?? null,
    kycStatus: "PENDING",
    onlineStatus: "OFFLINE",
  });

  return adminDriverView({
    ...profile,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      status: user.status,
      deletedAt: user.deletedAt,
    },
  });
}

export async function getDriverForAdmin(driverProfileId: string) {
  const row = await driverProfileRepository.findById(driverProfileId);
  if (!row || row.user.deletedAt) {
    throw new AppError(404, "Driver not found");
  }
  const documents = await driverDocumentRepository.listByProfile(row.id);
  return {
    ...adminDriverView(row),
    documents: documents.map(documentView),
  };
}

export async function approveDriver(driverProfileId: string, adminId: string) {
  const row = await driverProfileRepository.findById(driverProfileId);
  if (!row || row.user.deletedAt) {
    throw new AppError(404, "Driver not found");
  }
  if (row.kycStatus !== "UNDER_REVIEW") {
    throw new AppError(409, "Only a KYC submission under review can be approved");
  }
  if (row.user.status !== "ACTIVE") {
    throw new AppError(409, "The driver account must be active before approval");
  }

  const updated = await driverProfileRepository.update(row.id, {
    kycStatus: "APPROVED",
    approvedAt: new Date(),
    kycReviewedAt: new Date(),
    kycReviewedBy: adminId,
    kycRejectionReason: null,
  });

  return profileView(updated, row.user.status, row.user.deletedAt);
}

export async function rejectDriver(driverProfileId: string, adminId: string, reason: string) {
  const row = await driverProfileRepository.findById(driverProfileId);
  if (!row || row.user.deletedAt) {
    throw new AppError(404, "Driver not found");
  }
  if (row.kycStatus !== "UNDER_REVIEW") {
    throw new AppError(409, "Only a KYC submission under review can be rejected");
  }

  const updated = await driverProfileRepository.update(row.id, {
    kycStatus: "REJECTED",
    kycReviewedAt: new Date(),
    kycReviewedBy: adminId,
    kycRejectionReason: reason,
    approvedAt: null,
    onlineStatus: "OFFLINE",
  });

  return profileView(updated, row.user.status, row.user.deletedAt);
}

export async function suspendDriver(driverProfileId: string, reason: string) {
  const row = await driverProfileRepository.findById(driverProfileId);
  if (!row || row.user.deletedAt) {
    throw new AppError(404, "Driver not found");
  }
  if (row.user.status === "SUSPENDED" || row.user.status === "BLOCKED") {
    throw new AppError(409, "This driver account is already suspended or blocked");
  }

  await userRepository.update(row.userId, { status: "SUSPENDED" });
  await driverProfileRepository.update(row.id, { onlineStatus: "OFFLINE" });
  await refreshTokenRepository.revokeAllForUser(row.userId);

  return {
    id: row.id,
    userId: row.userId,
    accountStatus: "SUSPENDED" as const,
    canReceiveBookings: false,
    reason,
  };
}

export async function setDriverAvailability(userId: string, online: boolean) {
  const user = await requireDriverUser(userId);
  const profile = await ensureDriverProfile(user.id, user.fullName);
  if (
    online &&
    !canReceiveBookings({
      kycStatus: profile.kycStatus,
      accountStatus: user.status,
      deletedAt: user.deletedAt,
    })
  ) {
    throw new AppError(403, "Only an approved active driver can go online");
  }
  const updated = await driverProfileRepository.update(profile.id, {
    onlineStatus: online ? "ONLINE" : "OFFLINE",
  });
  return {
    onlineStatus: updated.onlineStatus,
    canReceiveBookings: canReceiveBookings({
      kycStatus: updated.kycStatus,
      accountStatus: user.status,
      deletedAt: user.deletedAt,
    }) && updated.onlineStatus === "ONLINE",
  };
}
