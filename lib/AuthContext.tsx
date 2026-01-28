"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabaseClient";
import { isBannedEmail } from "@/lib/supabase/banned";
import { ensureGoogleProfile, fetchProfileWithToken } from "@/lib/supabase/profile";
import type { AuthSession } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Use when calling Supabase with explicit JWT (e.g. tickets/requests insert). */
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const profileCreationInProgress = new Map<string, Promise<{ username: string; email: string; role: string }>>();

function ensureGoogleProfileGuarded(session: AuthSession): Promise<{ username: string; email: string; role: string }> {
  const userId = session.user.id;
  const inProgress = profileCreationInProgress.get(userId);
  if (inProgress) return inProgress;
  const promise = ensureGoogleProfile(session);
  profileCreationInProgress.set(userId, promise);
  promise.finally(() => profileCreationInProgress.delete(userId));
  return promise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearError = useCallback(() => setError(null), []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const redirectTo = `${origin}/auth/callback`;
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (err) {
      setError(err.message);
      throw err;
    }
    if (data?.url) window.location.href = data.url;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      await supabase.auth.refreshSession();
      const next = await supabase.auth.getSession();
      session = next.data.session;
    }
    return session?.access_token ?? null;
  }, []);

  useEffect(() => {
    let mounted = true;

    const applyUser = (
      u: { id: string; email?: string | null },
      username: string,
      email: string,
      role: string
    ) => {
      if (!mounted) return;
      setUser({
        id: u.id,
        email: email || (u.email ?? ""),
        username,
        isAdmin: role === "admin",
      });
    };

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session?.user) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const u = session.user;
      const email = u.email ?? "";
      const banned = await isBannedEmail(email, session.access_token);
      if (banned) {
        await supabase.auth.signOut();
        setUser(null);
        setError("Your account has been banned.");
        setIsLoading(false);
        return;
      }
      const profile = await fetchProfileWithToken(u.id, session.access_token);
      if (profile) {
        applyUser(u, profile.username, profile.email, profile.role);
      } else {
        try {
          const { username, email, role } = await ensureGoogleProfileGuarded(session);
          if (mounted) applyUser(u, username, email, role);
        } catch (e) {
          if (process.env.NODE_ENV === "development") console.error("[Auth] ensureGoogleProfile:", e);
          await supabase.auth.signOut();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_ev: string, session: AuthSession | null) => {
      if (!mounted) return;
      if (!session?.user) {
        setUser(null);
        return;
      }
      const u = session.user;
      const email = u.email ?? "";
      const banned = await isBannedEmail(email, session.access_token);
      if (banned) {
        await supabase.auth.signOut();
        setUser(null);
        setError("Your account has been banned.");
        return;
      }
      const profile = await fetchProfileWithToken(u.id, session.access_token);
      if (profile) {
        applyUser(u, profile.username, profile.email, profile.role);
      } else {
        try {
          const { username, email, role } = await ensureGoogleProfileGuarded(session);
          if (mounted) applyUser(u, username, email, role);
        } catch (e) {
          if (process.env.NODE_ENV === "development") console.error("[Auth] ensureGoogleProfile:", e);
          await supabase.auth.signOut();
          setUser(null);
        }
      }
    });

    const onOnline = () => {
      const current = userRef.current;
      if (!mounted || !current) return;
      supabase.auth.getSession().then(({ data: { session } }: { data: { session: AuthSession | null } }) => {
        if (!mounted || !session) return;
        fetchProfileWithToken(session.user.id, session.access_token).then((profile) => {
          if (!mounted || !profile) return;
          setUser((prev) =>
            prev
              ? { ...prev, username: profile.username, email: profile.email, isAdmin: profile.role === "admin" }
              : null
          );
        });
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoggedIn: !!user,
      isAdmin: !!user?.isAdmin,
      isLoading,
      error,
      clearError,
      signInWithGoogle,
      signOut,
      getAccessToken,
    }),
    [user, isLoading, error, clearError, signInWithGoogle, signOut, getAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
