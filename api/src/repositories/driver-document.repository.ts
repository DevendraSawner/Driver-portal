import type { DocumentType, DriverDocument, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const driverDocumentRepository = {
  listByProfile(driverProfileId: string): Promise<DriverDocument[]> {
    return prisma.driverDocument.findMany({
      where: { driverProfileId },
      orderBy: { createdAt: "desc" },
    });
  },

  async createMany(rows: Prisma.DriverDocumentCreateManyInput[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await prisma.driverDocument.createMany({ data: rows });
  },

  async supersede(driverProfileId: string, type: DocumentType): Promise<void> {
    await prisma.driverDocument.updateMany({
      where: { driverProfileId, type, status: "UPLOADED" },
      data: { status: "REJECTED", reviewNote: "Superseded by a newer upload" },
    });
  },
};
