import type { BookingOffer, OfferStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const bookingOfferRepository = {
  findPending(bookingId: string, driverId: string): Promise<BookingOffer | null> {
    return prisma.bookingOffer.findFirst({
      where: { bookingId, driverId, status: "PENDING" },
    });
  },

  listPendingForDriver(driverId: string): Promise<BookingOffer[]> {
    return prisma.bookingOffer.findMany({
      where: { driverId, status: "PENDING", booking: { status: "DRIVER_ASSIGNED" } },
      orderBy: { createdAt: "desc" },
    });
  },

  rejectedDriverIds(bookingId: string): Promise<string[]> {
    return prisma.bookingOffer
      .findMany({
        where: { bookingId, status: { in: ["REJECTED", "EXPIRED"] } },
        select: { driverId: true },
      })
      .then((rows) => rows.map((row) => row.driverId));
  },

  create(input: { bookingId: string; driverId: string; expiresAt: Date }): Promise<BookingOffer> {
    return prisma.bookingOffer.create({
      data: {
        bookingId: input.bookingId,
        driverId: input.driverId,
        status: "PENDING",
        expiresAt: input.expiresAt,
      },
    });
  },

  async close(id: string, status: Exclude<OfferStatus, "PENDING">): Promise<void> {
    await prisma.bookingOffer.update({
      where: { id },
      data: { status, respondedAt: new Date() },
    });
  },
};
