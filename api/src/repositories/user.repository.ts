import type { AccountStatus, Prisma, Role, User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notDeletedFilter } from "../utils/mongo-filters.js";

export type PublicUser = {
  id: string;
  role: Role;
  phone: string;
  email: string | null;
  fullName: string;
  status: AccountStatus;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
};

export const userRepository = {
  findByPhone(phone: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { phone } });
  },

  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email, AND: [notDeletedFilter()] } });
  },

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      role: user.role,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      phoneVerifiedAt: user.phoneVerifiedAt,
      createdAt: user.createdAt,
    };
  },
};

