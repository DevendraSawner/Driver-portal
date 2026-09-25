import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAccessToken } from "../api/client";
import type { Account, ApiSuccess } from "../types/api";

type AuthState = {
  admin: Account | null;
  ready: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [admin, setAdmin] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .post<ApiSuccess<{ accessToken: string; user: Account }>>("/api/v1/auth/refresh", {})
      .then((response) => {
        const user = response.data.data.user;
        if (user.role !== "ADMIN") {
          setAccessToken(null);
          return;
        }
        setAccessToken(response.data.data.accessToken);
        if (active) {
          setAdmin(user);
        }
      })
      .catch(() => {
        setAccessToken(null);
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      admin,
      ready,
      async login(phone: string, password: string) {
        const response = await api.post<ApiSuccess<{ accessToken: string; user: Account }>>(
          "/api/v1/auth/login",
          { phone, password },
        );
        const user = response.data.data.user;
        if (user.role !== "ADMIN") {
          setAccessToken(null);
          await api.post("/api/v1/auth/logout", {});
          throw new Error("This portal is for admin accounts");
        }
        setAccessToken(response.data.data.accessToken);
        setAdmin(user);
      },
      async logout() {
        await api.post("/api/v1/auth/logout", {});
        setAccessToken(null);
        setAdmin(null);
        queryClient.clear();
      },
    }),
    [admin, queryClient, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
