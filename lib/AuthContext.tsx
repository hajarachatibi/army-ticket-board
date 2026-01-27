"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { formatError } from "@/lib/formatError";
import { supabase } from "@/lib/supabaseClient";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  openAuthModal: (mode?: "login" | "register") => void;
  closeAuthModal: () => void;
  authModalOpen: boolean;
  authModalMode: "login" | "register";
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<{ username: string } | null> {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("username")
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    return { username: String(data.username ?? "ARMY") };
  } catch {
    return null;
  }
}

/** Ensure user_profiles row exists for this auth user (fixes tickets.owner_id FK). */
async function ensureUserProfile(
  userId: string,
  email: string
): Promise<{ username: string } | null> {
  const existing = await fetchProfile(userId);
  if (existing) return existing;

  const fallback = `user-${userId.slice(0, 8)}`;
  const fromEmail = (email || "").split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "_")?.slice(0, 30) || fallback;
  const candidates = [fromEmail, fallback];

  for (const username of candidates) {
    const { data, error } = await supabase
      .from("user_profiles")
      .insert({
        id: userId,
        username,
        email: email || null,
        role: "user",
      })
      .select("username")
      .single();

    if (!error && data) return { username: String(data.username ?? "ARMY") };
    const msg = getErrorFields(error).message;
    const isUnique = /unique|duplicate|username/i.test(msg);
    if (!isUnique && process.env.NODE_ENV === "development") {
      console.warn("[Auth] ensureUserProfile insert error:", error);
    }
    if (!isUnique) return null;
  }
  return null;
}

const DB_SAVE_USER_HINT = `
---
This occurs when Supabase Auth creates the user (before we insert into user_profiles).

Likely causes:
• A database TRIGGER on auth.users (runs on INSERT) is failing—e.g. one that inserts into user_profiles. Check Supabase Dashboard → Database → Triggers. Remove or fix any trigger on auth.users.
• Supabase Dashboard → Logs → Postgres logs often show the underlying error.
• Auth hooks (if enabled) can also fail here.
`.trim();

function formatSignUpError(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: string; status?: number };
    const code = (e.code ?? "").toLowerCase();
    const status = e.status;
    if (code === "over_email_send_rate_limit" || status === 429) {
      return [
        "Too many sign-up attempts — email rate limit exceeded.",
        "",
        "The limit is on how many auth emails your project can send in a short time (across all users). Using a different email won't help.",
        "",
        "What to do:",
        "• Wait 10–30 minutes, then try again.",
        "• Or disable \"Confirm email\" in Supabase Dashboard → Authentication → Providers → Email. Sign-ups will then work without sending emails (handy for local/dev).",
      ].join("\n");
    }
  }
  return formatError(err, "Sign up");
}

function getErrorFields(err: unknown): { message: string; code: string; details: string; hint: string } {
  if (typeof err !== "object" || err === null) return { message: "", code: "", details: "", hint: "" };
  const e = err as { message?: string; code?: string; details?: unknown; hint?: string };
  return {
    message: String(e.message ?? ""),
    code: String(e.code ?? ""),
    details: typeof e.details === "string" ? e.details : (e.details != null ? JSON.stringify(e.details) : ""),
    hint: String(e.hint ?? ""),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");

  const clearError = useCallback(() => setError(null), []);
  const openAuthModal = useCallback((mode: "login" | "register" = "login") => {
    setAuthModalMode(mode);
    setError(null);
    setAuthModalOpen(true);
  }, []);
  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setError(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      const msg = formatError(err, "Login");
      setError(msg);
      if (process.env.NODE_ENV === "development") console.error("[Auth] Login error:", err);
      throw err;
    }
    if (!data.user) return;
    let profile = await fetchProfile(data.user.id);
    if (!profile) {
      await ensureUserProfile(data.user.id, data.user.email ?? "");
      profile = await fetchProfile(data.user.id);
    }
    setUser({
      id: data.user.id,
      email: data.user.email ?? "",
      username: profile?.username ?? "ARMY",
    });
    closeAuthModal();
  }, [closeAuthModal]);

  const register = useCallback(
    async (email: string, password: string, username: string) => {
      setError(null);
      const { data, error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) {
        const isRateLimit = (() => {
          if (typeof signUpErr !== "object" || signUpErr === null) return false;
          const e = signUpErr as { code?: string; status?: number };
          return e.code === "over_email_send_rate_limit" || e.status === 429;
        })();
        const { message: signUpMsg } = getErrorFields(signUpErr);
        const isDbSave = signUpMsg.toLowerCase().includes("database error saving new user");
        const base = isRateLimit ? formatSignUpError(signUpErr) : formatError(signUpErr, "Sign up");
        const msg = isDbSave ? `${base}\n\n${DB_SAVE_USER_HINT}` : base;
        setError(msg);
        if (process.env.NODE_ENV === "development") {
          console.error("[Auth] Sign up error:", signUpErr);
          if (isDbSave) console.error("[Auth] Sign up failed at auth layer (auth.users). Check Supabase Dashboard → Logs → Postgres for the underlying DB error.");
        }
        throw signUpErr;
      }
      if (!data.user) {
        setError("[Sign up] No user in response. If email confirmation is enabled, confirm your email first, then log in.");
        return;
      }

      const userId = data.user.id;
      const insertPayload = {
        id: userId,
        username: username.trim(),
        role: "user",
      };

      const insertRes = await supabase.from("user_profiles").insert(insertPayload);
      const insertErr = insertRes.error;

      if (insertErr) {
        const { message: msg, code, details, hint } = getErrorFields(insertErr);
        const isDuplicatePkey = code === "23505" && /user_profiles_pkey/.test(msg);

        if (isDuplicatePkey) {
          const profile = await fetchProfile(data.user.id);
          setUser({
            id: data.user.id,
            email: data.user.email ?? email,
            username: profile?.username ?? username.trim(),
          });
          closeAuthModal();
          return;
        }

        const full = [
          `[user_profiles insert] ${msg}`,
          code && `Code: ${code}`,
          details && `Details: ${details}`,
          hint && `Hint: ${hint}`,
        ]
          .filter(Boolean)
          .join("\n");
        const lower = msg.toLowerCase();
        const friendly =
          lower.includes("unique") || lower.includes("duplicate") || lower.includes("username")
            ? "Username may be taken or invalid.\n\n"
            : "";
        const rlsHint = `
---
If you use RLS on user_profiles, add a policy to allow insert:
  CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
`.trim();
        setError(`${friendly}${full}\n\nPayload: ${JSON.stringify(insertPayload, null, 2)}\n\n${rlsHint}`);
        if (process.env.NODE_ENV === "development") {
          console.error("[Auth] user_profiles insert error:", { message: msg, code, details, hint }, "Payload:", insertPayload);
        }
        await supabase.auth.signOut();
        throw insertErr;
      }

      const profile = await fetchProfile(data.user.id);
      setUser({
        id: data.user.id,
        email: data.user.email ?? email,
        username: profile?.username ?? username,
      });
      closeAuthModal();
    },
    [closeAuthModal]
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!u) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      let profile = await fetchProfile(u.id);
      if (!profile) {
        await ensureUserProfile(u.id, u.email ?? "");
        profile = await fetchProfile(u.id);
      }
      setUser({
        id: u.id,
        email: u.email ?? "",
        username: profile?.username ?? "ARMY",
      });
      setIsLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_ev, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setUser(null);
        return;
      }
      let profile = await fetchProfile(session.user.id);
      if (!profile) {
        await ensureUserProfile(session.user.id, session.user.email ?? "");
        profile = await fetchProfile(session.user.id);
      }
      setUser({
        id: session.user.id,
        email: session.user.email ?? "",
        username: profile?.username ?? "ARMY",
      });
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoggedIn: !!user,
      isLoading,
      error,
      clearError,
      login,
      register,
      logout,
      openAuthModal,
      closeAuthModal,
      authModalOpen,
      authModalMode,
    }),
    [user, isLoading, error, clearError, login, register, logout, openAuthModal, closeAuthModal, authModalOpen, authModalMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
