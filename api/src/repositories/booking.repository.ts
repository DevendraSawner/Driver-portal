import type { Booking, BookingStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { assertTransition } from "../services/booking-state-machine.js";

const bookingInclude = {
  vehicle: {
    select: {
      id: true,
      registrationNumber: true,
      brand: true,
      model: true,
      vehicleType: true,
    },
  },
  user: { select: { id: true, fullName: true, phone: true } },
  driver: { select: { id: true, fullName: true, phone: true } },
} satisfies Prisma.BookingInclude;

export type BookingView = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

export const bookingRepository = {
  findById(id: string): Promise<BookingView | null> {
    return prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  },

  findOpenForUser(userId: string, statuses: BookingStatus[]): Promise<Booking | null> {
    return prisma.booking.findFirst({
      where: { userId, status: { in: statuses } },
    });
  },

  findActiveForDriver(driverId: string, statuses: BookingStatus[]): Promise<Booking | null> {
    return prisma.booking.findFirst({
      where: { driverId, status: { in: statuses } },
    });
  },

  create(data: Prisma.BookingCreateInput, history: { actorUserId: string; actorRole: Role }): Promise<BookingView> {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({ data, include: bookingInclude });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: booking.status,
          actorUserId: history.actorUserId,
          actorRole: history.actorRole,
        },
      });
      return booking;
    });
  },

  async transition(input: {
    id: string;
    from: BookingStatus;
    to: BookingStatus;
    data?: Prisma.BookingUpdateManyMutationInput;
    driverId?: string | null;
    actorUserId?: string;
    actorRole?: Role;
    reason?: string;
  }): Promise<BookingView> {
    assertTransition(input.from, input.to);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id: input.id, status: input.from },
        data: { status: input.to, ...input.data },
      });
      if (updated.count !== 1) {
        throw new AppError(409, "Booking status changed before this action completed");
      }
      if (input.driverId !== undefined) {
        await tx.booking.update({
          where: { id: input.id },
          data: input.driverId
            ? { driver: { connect: { id: input.driverId } } }
            : { driver: { disconnect: true } },
        });
      }
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: input.id,
          fromStatus: input.from,
          toStatus: input.to,
          actorUserId: input.actorUserId,
          actorRole: input.actorRole,
          reason: input.reason,
        },
      });
      const booking = await tx.booking.findUnique({ where: { id: input.id }, include: bookingInclude });
      if (!booking) {
        throw new AppError(404, "Booking not found");
      }
      return booking;
    });
  },

  listForUser(userId: string, skip: number, take: number): Promise<{ items: BookingView[]; total: number }> {
    return listWhere({ userId }, skip, take);
  },

  listForDriver(driverId: string, skip: number, take: number): Promise<{ items: BookingView[]; total: number }> {
    return listWhere({ driverId }, skip, take);
  },

  listAll(skip: number, take: number): Promise<{ items: BookingView[]; total: number }> {
    return listWhere({}, skip, take);
  },

  async busyDriverIds(statuses: BookingStatus[]): Promise<string[]> {
    const rows = await prisma.booking.findMany({
      where: { status: { in: statuses }, driverId: { not: null } },
      select: { driverId: true },
    });
    return rows.flatMap((row) => (row.driverId ? [row.driverId] : []));
  },

  findDuePending(before: Date): Promise<BookingView[]> {
    return prisma.booking.findMany({
      where: { status: "PENDING", scheduledAt: { lte: before } },
      include: bookingInclude,
      take: 20,
    });
  },
};

async function listWhere(
  where: Prisma.BookingWhereInput,
  skip: number,
  take: number,
): Promise<{ items: BookingView[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.booking.count({ where }),
  ]);
  return { items, total };
}
