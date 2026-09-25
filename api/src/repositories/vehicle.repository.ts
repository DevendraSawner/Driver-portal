import type { CustomerVehicle, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notDeletedFilter } from "../utils/mongo-filters.js";

export const vehicleRepository = {
  async registrationTaken(registrationNumber: string, exceptId?: string): Promise<boolean> {
    const existing = await prisma.customerVehicle.findFirst({
      where: {
        registrationNumber,
        AND: [notDeletedFilter()],
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    return existing !== null;
  },

  create(data: Prisma.CustomerVehicleCreateInput): Promise<CustomerVehicle> {
    return prisma.customerVehicle.create({ data });
  },

  findOwned(id: string, userId: string): Promise<CustomerVehicle | null> {
    return prisma.customerVehicle.findFirst({
      where: { id, userId, AND: [notDeletedFilter()] },
    });
  },

  listByOwner(userId: string): Promise<CustomerVehicle[]> {
    return prisma.customerVehicle.findMany({
      where: { userId, AND: [notDeletedFilter()] },
      orderBy: { createdAt: "desc" },
    });
  },

  update(id: string, data: Prisma.CustomerVehicleUpdateInput): Promise<CustomerVehicle> {
    return prisma.customerVehicle.update({ where: { id }, data });
  },
};
