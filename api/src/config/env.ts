import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().min(1).default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  CORS_ORIGINS: z.string().min(1),
  OTP_DELIVERY: z.enum(["console", "disabled"]).default("console"),
  OTP_HASH_SECRET: z.string().min(32),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().max(60).default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().max(10).default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().max(600).default(60),
  PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10000),
  SEARCH_TIMEOUT_MINUTES: z.coerce.number().int().positive().max(180).default(15),
  SCHEDULED_SEARCH_LEAD_MINUTES: z.coerce.number().int().positive().max(1440).default(60),
  SCHEDULE_MAX_DAYS: z.coerce.number().int().positive().max(90).default(30),
  PAYMENT_PROVIDER: z.enum(["sandbox", "phonepe"]).default("sandbox"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),
  PHONEPE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  PHONEPE_CLIENT_ID: z.string().optional(),
  PHONEPE_CLIENT_SECRET: z.string().optional(),
  PHONEPE_CLIENT_VERSION: z.string().optional(),
  PHONEPE_REDIRECT_URL: z.string().url().optional(),
  PHONEPE_WEBHOOK_USERNAME: z.string().optional(),
  PHONEPE_WEBHOOK_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const env = parsed.data;
  if (env.NODE_ENV === "production" && env.OTP_DELIVERY === "console") {
    throw new Error("OTP_DELIVERY=console is not allowed in production");
  }
  if (env.PAYMENT_PROVIDER === "phonepe") {
    const missing = [
      ["PHONEPE_CLIENT_ID", env.PHONEPE_CLIENT_ID],
      ["PHONEPE_CLIENT_SECRET", env.PHONEPE_CLIENT_SECRET],
      ["PHONEPE_CLIENT_VERSION", env.PHONEPE_CLIENT_VERSION],
      ["PHONEPE_REDIRECT_URL", env.PHONEPE_REDIRECT_URL],
      ["PHONEPE_WEBHOOK_USERNAME", env.PHONEPE_WEBHOOK_USERNAME],
      ["PHONEPE_WEBHOOK_PASSWORD", env.PHONEPE_WEBHOOK_PASSWORD],
    ].filter(([, value]) => !value);
    if (missing.length > 0) {
      throw new Error(`PhonePe requires ${missing.map(([name]) => name).join(", ")}`);
    }
  }

  return env;
}

export const env = loadEnv();

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
