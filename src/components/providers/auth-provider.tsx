"use client";

/**
 * Auth context — the client-side source of truth for the current session.
 *
 * On boot, it pings `/auth/me` (using the httpOnly cookie) to hydrate the
 * session. If the access token has expired, the refresh endpoint is called
 * transparently once. All API requests made through `apiClient` will
 * automatically include the access token via `setAccessToken`.
 */

import * as React from "react";
import { apiClient, setAccessToken, onTokenChange, ApiClientError } from "@/lib/api-client";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True only during the initial boot hydration. */
  booting: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [booting, setBooting] = React.useState(true);

  const boot = React.useCallback(async () => {
    try {
      const result = await apiClient.post<{ user: User }>("/auth/refresh");
      setAccessToken(result.accessToken);
      setUser(result.user);
    } catch {
      // No valid session — that's fine, user is just not logged in.
      setAccessToken(null);
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  React.useEffect(() => {
    void boot();
  }, [boot]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await apiClient.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/auth/login", { email, password });
      setAccessToken(result.accessToken);
      setUser(result.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = React.useCallback(async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const result = await apiClient.post<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/auth/register", { name, email, password });
      setAccessToken(result.accessToken);
      setUser(result.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // ignore — we clear local state regardless
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      const result = await apiClient.post<{ user: User; accessToken: string }>("/auth/refresh");
      setAccessToken(result.accessToken);
      setUser(result.user);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        setAccessToken(null);
        setUser(null);
      }
    }
  }, []);

  // Auto-refresh on 401 — listen for token revocation.
  React.useEffect(() => {
    return onTokenChange((token) => {
      if (!token && user) {
        // Token was cleared — likely by an interceptor. Refresh if possible.
        void refresh();
      }
    });
  }, [user, refresh]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, loading, booting, signIn, signUp, signOut, refresh }),
    [user, loading, booting, signIn, signUp, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
