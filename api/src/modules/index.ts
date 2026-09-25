import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import { adminRouter } from "../routes/admin.routes.js";
import { authRouter } from "../routes/auth.routes.js";
import { bookingRouter } from "../routes/booking.routes.js";
import { driverRouter } from "../routes/driver.routes.js";
import { paymentRouter } from "../routes/payment.routes.js";
import { userRouter } from "../routes/user.routes.js";
import { vehicleRouter } from "../routes/vehicle.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/vehicles", vehicleRouter);
apiRouter.use("/bookings", bookingRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/driver", driverRouter);
apiRouter.use("/admin", adminRouter);
