import { Router } from "express";
import { getMe, patchMe } from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { updateMeSchema } from "../validators/profile.validator.js";

export const userRouter = Router();

userRouter.get("/me", requireAuth, getMe);
userRouter.patch("/me", requireAuth, validate({ body: updateMeSchema }), patchMe);
