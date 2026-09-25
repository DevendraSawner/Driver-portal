import type { OtpChallenge, OtpPurpose } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const otpRepository = {
  create(input: {
    userId: string;
    phone: string;
    purpose: OtpPurpose;
    codeHash: string;
    expiresAt: Date;
  }): Promise<OtpChallenge> {
    return prisma.otpChallenge.create({ data: input });
  },

  findLatestOpen(phone: string, purpose: OtpPurpose): Promise<OtpChallenge | null> {
    return prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async incrementAttempts(id: string): Promise<void> {
    await prisma.otpChallenge.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
    });
  },

  async consume(id: string): Promise<void> {
    await prisma.otpChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },

  async consumeOpen(phone: string, purpose: OtpPurpose): Promise<void> {
    await prisma.otpChallenge.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  },
};
