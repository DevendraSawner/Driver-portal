import type { Payment, PaymentStatus, PlatformFee, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const paymentRepository = {
  findById(id: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { id } });
  },

  findByIdempotency(payerUserId: string, idempotencyKey: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { payerUserId_idempotencyKey: { payerUserId, idempotencyKey } } });
  },

  findByProviderRef(providerRef: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { providerRef } });
  },

  listForBooking(bookingId: string): Promise<Payment[]> {
    return prisma.payment.findMany({ where: { bookingId } });
  },

  create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return prisma.payment.create({ data });
  },

  update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return prisma.payment.update({ where: { id }, data });
  },

  async list(skip: number, take: number, where: Prisma.PaymentWhereInput = {}) {
    const [items, total] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.payment.count({ where }),
    ]);
    return { items, total };
  },
};

export const platformFeeRepository = {
  findByBooking(bookingId: string): Promise<PlatformFee | null> {
    return prisma.platformFee.findUnique({ where: { bookingId } });
  },

  listForDriver(driverId: string, status?: PlatformFee["status"]): Promise<PlatformFee[]> {
    return prisma.platformFee.findMany({
      where: { driverId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });
  },

  async list(skip: number, take: number, where: Prisma.PlatformFeeWhereInput) {
    const [items, total] = await Promise.all([
      prisma.platformFee.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.platformFee.count({ where }),
    ]);
    return { items, total };
  },

  create(data: Prisma.PlatformFeeCreateInput): Promise<PlatformFee> {
    return prisma.platformFee.create({ data });
  },

  update(id: string, status: PlatformFee["status"]): Promise<PlatformFee> {
    return prisma.platformFee.update({ where: { id }, data: { status } });
  },

  async markPaid(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await prisma.platformFee.updateMany({ where: { id: { in: ids }, status: "DUE" }, data: { status: "PAID" } });
  },
};

export const ledgerRepository = {
  findByDriver(driverId: string) {
    return prisma.driverLedger.findUnique({ where: { driverId } });
  },

  async listEntries(driverId: string, skip: number, take: number) {
    const [items, total] = await Promise.all([
      prisma.walletTransaction.findMany({ where: { driverId }, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.walletTransaction.count({ where: { driverId } }),
    ]);
    return { items, total };
  },
};

export const settlementRepository = {
  findByIdempotency(driverId: string, idempotencyKey: string) {
    return prisma.driverSettlement.findUnique({ where: { driverId_idempotencyKey: { driverId, idempotencyKey } } });
  },

  findByProviderRef(providerRef: string) {
    return prisma.driverSettlement.findUnique({ where: { providerRef } });
  },

  async listForDriver(driverId: string, skip: number, take: number) {
    const where = { driverId };
    const [items, total] = await Promise.all([
      prisma.driverSettlement.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.driverSettlement.count({ where }),
    ]);
    return { items, total };
  },

  async list(skip: number, take: number) {
    const [items, total] = await Promise.all([
      prisma.driverSettlement.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
      prisma.driverSettlement.count(),
    ]);
    return { items, total };
  },
};

export type { PaymentStatus };
