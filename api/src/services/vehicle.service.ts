import type { CustomerVehicle } from "@prisma/client";
import { vehicleRepository } from "../repositories/vehicle.repository.js";
import { AppError } from "../utils/app-error.js";
import type { z } from "zod";
import type { updateVehicleSchema, vehicleSchema } from "../validators/vehicle.validator.js";

type VehicleInput = z.infer<typeof vehicleSchema>;
type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

function view(vehicle: CustomerVehicle) {
  return {
    id: vehicle.id,
    registrationNumber: vehicle.registrationNumber,
    vehicleType: vehicle.vehicleType,
    brand: vehicle.brand,
    model: vehicle.model,
    transmission: vehicle.transmission,
    fuelType: vehicle.fuelType,
    color: vehicle.color,
    rcFileKey: vehicle.rcFileKey,
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

export async function createVehicle(userId: string, input: VehicleInput) {
  const registrationNumber = input.registrationNumber.toUpperCase();
  if (await vehicleRepository.registrationTaken(registrationNumber)) {
    throw new AppError(409, "A vehicle with this registration number already exists");
  }

  const vehicle = await vehicleRepository.create({
    user: { connect: { id: userId } },
    registrationNumber,
    vehicleType: input.vehicleType,
    brand: input.brand,
    model: input.model,
    transmission: input.transmission,
    fuelType: input.fuelType,
    color: input.color,
    rcFileKey: input.rcFileKey,
  });
  return view(vehicle);
}

export async function listVehicles(userId: string) {
  const vehicles = await vehicleRepository.listByOwner(userId);
  return vehicles.map(view);
}

export async function getVehicle(userId: string, vehicleId: string) {
  const vehicle = await vehicleRepository.findOwned(vehicleId, userId);
  if (!vehicle) {
    throw new AppError(404, "Vehicle not found");
  }
  return view(vehicle);
}

export async function updateVehicle(userId: string, vehicleId: string, input: UpdateVehicleInput) {
  const existing = await vehicleRepository.findOwned(vehicleId, userId);
  if (!existing) {
    throw new AppError(404, "Vehicle not found");
  }

  const registrationNumber = input.registrationNumber?.toUpperCase();
  if (registrationNumber && (await vehicleRepository.registrationTaken(registrationNumber, existing.id))) {
    throw new AppError(409, "A vehicle with this registration number already exists");
  }

  const vehicle = await vehicleRepository.update(existing.id, {
    ...(registrationNumber !== undefined ? { registrationNumber } : {}),
    ...(input.vehicleType !== undefined ? { vehicleType: input.vehicleType } : {}),
    ...(input.brand !== undefined ? { brand: input.brand } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.transmission !== undefined ? { transmission: input.transmission } : {}),
    ...(input.fuelType !== undefined ? { fuelType: input.fuelType } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.rcFileKey !== undefined ? { rcFileKey: input.rcFileKey } : {}),
  });
  return view(vehicle);
}

export async function deleteVehicle(userId: string, vehicleId: string) {
  const existing = await vehicleRepository.findOwned(vehicleId, userId);
  if (!existing) {
    throw new AppError(404, "Vehicle not found");
  }
  await vehicleRepository.update(existing.id, { deletedAt: new Date() });
}
