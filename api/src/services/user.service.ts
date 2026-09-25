import { userProfileRepository } from "../repositories/user-profile.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/app-error.js";
import type { z } from "zod";
import type { updateMeSchema } from "../validators/profile.validator.js";

type UpdateMeInput = z.infer<typeof updateMeSchema>;

function profileView(profile: {
  avatarUrl: string | null;
  city: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
} | null) {
  if (!profile) {
    return null;
  }
  return {
    avatarUrl: profile.avatarUrl,
    city: profile.city,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
  };
}

export async function getCurrentUser(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user || user.deletedAt) {
    throw new AppError(401, "Authentication required");
  }

  const profile = user.role === "USER" ? await userProfileRepository.findByUserId(user.id) : null;
  return {
    ...userRepository.toPublic(user),
    profile: profileView(profile),
  };
}

export async function updateCurrentUser(userId: string, input: UpdateMeInput) {
  const user = await userRepository.findById(userId);
  if (!user || user.deletedAt) {
    throw new AppError(401, "Authentication required");
  }

  const profileFields = {
    avatarUrl: input.avatarUrl,
    city: input.city,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
  };
  const hasProfileFields = Object.values(profileFields).some((value) => value !== undefined);

  if (hasProfileFields && user.role !== "USER") {
    throw new AppError(422, "Profile details can only be updated on a customer account");
  }

  if (input.email && input.email !== user.email) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing && existing.id !== user.id && !existing.deletedAt) {
      throw new AppError(409, "An account with this email already exists");
    }
  }

  const updated = await userRepository.update(user.id, {
    ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
  });

  let profile = user.role === "USER" ? await userProfileRepository.findByUserId(user.id) : null;
  if (user.role === "USER" && hasProfileFields) {
    profile = await userProfileRepository.upsert(user.id, {
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.emergencyContactName !== undefined ? { emergencyContactName: input.emergencyContactName } : {}),
      ...(input.emergencyContactPhone !== undefined ? { emergencyContactPhone: input.emergencyContactPhone } : {}),
    });
  }

  return {
    ...userRepository.toPublic(updated),
    profile: profileView(profile),
  };
}
