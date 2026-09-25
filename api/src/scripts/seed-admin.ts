import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";

async function seedAdmin(): Promise<void> {
  const phone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME?.trim();

  if (!phone || !password || !fullName) {
    throw new Error("ADMIN_PHONE, ADMIN_PASSWORD, and ADMIN_FULL_NAME are required");
  }

  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("ADMIN_PHONE must be E.164");
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    throw new Error("An account with ADMIN_PHONE already exists");
  }

  await prisma.user.create({
    data: {
      role: "ADMIN",
      phone,
      fullName,
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      phoneVerifiedAt: new Date(),
    },
  });

  console.log(JSON.stringify({ message: "Admin created", phone, env: env.NODE_ENV }));
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
