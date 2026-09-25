import type { Role } from "@prisma/client";

export type AuthUser = {
  id: string;
  role: Role;
  status: "ACTIVE";
  phone: string;
  email: string | null;
  fullName: string;
  sessionId: string;
};

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      authUser?: AuthUser;
    }
  }
}

export {};
