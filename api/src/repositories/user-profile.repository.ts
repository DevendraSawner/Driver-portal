import type { UserProfile } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type ProfileFields = {
  avatarUrl?: string | null;
  city?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
};

export const userProfileRepository = {
  findByUserId(userId: string): Promise<UserProfile | null> {
    return prisma.userProfile.findUnique({ where: { userId } });
  },

  upsert(userId: string, data: ProfileFields): Promise<UserProfile> {
    return prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },
};
