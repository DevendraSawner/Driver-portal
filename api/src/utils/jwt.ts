import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  role: Role;
  sid: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || !decoded.sub || !decoded.role || !decoded.sid) {
    throw new Error("Invalid access token payload");
  }
  return {
    sub: String(decoded.sub),
    role: decoded.role as Role,
    sid: String(decoded.sid),
  };
}
