import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as loginRequest, logout as logoutRequest, register as registerRequest } from "../api/auth";
import { setSession, setUnauthorizedHandler } from "../api/client";
import { getMe } from "../api/user";
import type { Account } from "../types/models";

const STORAGE_KEY = "driver-platform.session";

type Session = { accessToken: string; refreshToken: string; user: Account };

type AuthState = {
  ready: boolean;
  seenOnboarding: boolean;
  user: Account | null;
  completeOnboarding: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: { role: "USER" | "DRIVER"; phone: string; password: string; fullName: string; email?: string }) => Promise<string>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function persist(session: Session | null): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setSession({ accessToken: null, refreshToken: null });
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  setSession(session);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [seenOnboarding, setSeenOnboarding] = useState(false);

  useEffect(() => {
    let active = true;
    setUnauthorizedHandler(() => {
      void persist(null).then(() => setUser(null));
    });
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem("driver-platform.onboarding")])
      .then(async ([raw, onboarding]) => {
        if (active) {
          setSeenOnboarding(onboarding === "1");
        }
        if (!raw) {
          return;
        }
        const saved = JSON.parse(raw) as Session;
        setSession(saved);
        const account = await getMe();
        if (active) {
          setUser(account);
        }
      })
      .catch(async () => {
        await persist(null);
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
      ready,
      seenOnboarding,
      user,
      async completeOnboarding() {
        await AsyncStorage.setItem("driver-platform.onboarding", "1");
        setSeenOnboarding(true);
      },
      async login(phone, password) {
        const session = await loginRequest(phone, password);
        if (session.user.role === "ADMIN") {
          throw new Error("Admin accounts use the web portal");
        }
        await persist(session);
        setUser(session.user);
      },
      register: (input) => registerRequest(input).then(() => "Account created. Verify the code sent to your phone."),
      async logout() {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as Session) : null;
        await logoutRequest(saved?.refreshToken);
        await persist(null);
        setUser(null);
      },
    }),
    [ready, seenOnboarding, user],
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
