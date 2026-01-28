"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, signInWithGoogle, error, clearError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const banned = searchParams.get("banned") === "1";

  useEffect(() => {
    if (!isLoading && user) router.replace("/tickets");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!banned) clearError();
  }, [banned, clearError]);

  const handleGoogleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      /* error set in context */
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-army-subtle">
        <p className="text-army-purple">Loading…</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-army-subtle">
        <p className="text-army-purple">Redirecting…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-army-subtle px-4">
      <h1 className="font-display text-2xl font-bold text-army-purple sm:text-3xl">
        Get started
      </h1>
      <p className="text-center text-neutral-600 dark:text-neutral-400">
        Connect with your Gmail to buy, sell, and chat. One account, no password.
      </p>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="btn-army flex w-full items-center justify-center gap-2"
          disabled={submitting}
        >
          <GoogleIcon />
          {submitting ? "Connecting…" : "Continue with Google"}
        </button>
        {(banned || error) && (
          <div
            className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
            role="alert"
          >
            {banned ? "Your account has been banned." : error}
          </div>
        )}
      </div>
      <Link href="/" className="btn-army-outline">
        Back to Home
      </Link>
    </main>
  );
}
