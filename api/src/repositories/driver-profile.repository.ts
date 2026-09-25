import type { AccountStatus, DriverProfile, KycStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notDeletedFilter } from "../utils/mongo-filters.js";

export type DriverListRow = DriverProfile & {
  user: {
    id: string;
    phone: string;
    email: string | null;
    status: AccountStatus;
    deletedAt: Date | null;
  };
};

export const driverProfileRepository = {
  findByUserId(userId: string): Promise<DriverProfile | null> {
    return prisma.driverProfile.findUnique({ where: { userId } });
  },

  findOnlineApproved(excludedUserIds: string[]): Promise<{ userId: string }[]> {
    return prisma.driverProfile.findMany({
      where: {
        AND: [notDeletedFilter()],
        onlineStatus: "ONLINE",
        kycStatus: "APPROVED",
        userId: { notIn: excludedUserIds },
        user: { status: "ACTIVE", role: "DRIVER", AND: [notDeletedFilter()] },
      },
      select: { userId: true },
      orderBy: { updatedAt: "asc" },
      take: 20,
    });
  },

  findById(id: string): Promise<DriverListRow | null> {
    return prisma.driverProfile.findFirst({
      where: { id, AND: [notDeletedFilter()] },
      include: {
        user: { select: { id: true, phone: true, email: true, status: true, deletedAt: true } },
      },
    });
  },

  create(data: Prisma.DriverProfileCreateInput): Promise<DriverProfile> {
    return prisma.driverProfile.create({ data });
  },

  update(id: string, data: Prisma.DriverProfileUpdateInput): Promise<DriverProfile> {
    return prisma.driverProfile.update({ where: { id }, data });
  },

  async list(input: {
    skip: number;
    take: number;
    kycStatus?: KycStatus;
    accountStatus?: AccountStatus;
    search?: string;
  }): Promise<{ items: DriverListRow[]; total: number }> {
    const where: Prisma.DriverProfileWhereInput = {
      AND: [notDeletedFilter()],
      ...(input.kycStatus ? { kycStatus: input.kycStatus } : {}),
      user: {
        role: "DRIVER",
        AND: [notDeletedFilter()],
        ...(input.accountStatus ? { status: input.accountStatus } : {}),
      },
      ...(input.search
        ? {
            OR: [
              { fullName: { contains: input.search, mode: "insensitive" } },
              { city: { contains: input.search, mode: "insensitive" } },
              { user: { phone: { contains: input.search } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.driverProfile.findMany({
        where,
        include: {
          user: { select: { id: true, phone: true, email: true, status: true, deletedAt: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: input.skip,
        take: input.take,
      }),
      prisma.driverProfile.count({ where }),
    ]);

    return { items, total };
  },
};
