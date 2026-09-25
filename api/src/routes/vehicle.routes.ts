import { Router } from "express";
import { getVehicleById, getVehicles, patchVehicle, postVehicle, removeVehicle } from "../controllers/vehicle.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/role.js";
import { validate } from "../middlewares/validate.js";
import { objectIdParamsSchema } from "../validators/driver.validator.js";
import { updateVehicleSchema, vehicleSchema } from "../validators/vehicle.validator.js";

export const vehicleRouter = Router();

vehicleRouter.use(requireAuth, requireRoles("USER"));
vehicleRouter.post("/", validate({ body: vehicleSchema }), postVehicle);
vehicleRouter.get("/", getVehicles);
vehicleRouter.get("/:id", validate({ params: objectIdParamsSchema }), getVehicleById);
vehicleRouter.patch("/:id", validate({ params: objectIdParamsSchema, body: updateVehicleSchema }), patchVehicle);
vehicleRouter.delete("/:id", validate({ params: objectIdParamsSchema }), removeVehicle);
