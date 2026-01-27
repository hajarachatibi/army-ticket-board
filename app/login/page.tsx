"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading, openAuthModal } = useAuth();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) openAuthModal("login");
  }, [isLoading, isLoggedIn, openAuthModal]);

  useEffect(() => {
    if (!isLoading && isLoggedIn) router.replace("/tickets");
  }, [isLoading, isLoggedIn, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-army-subtle">
        <p className="text-army-purple">Loading…</p>
      </main>
    );
  }

  if (isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-army-subtle">
        <p className="text-army-purple">Redirecting…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-army-subtle px-4">
      <p className="text-center text-neutral-600 dark:text-neutral-400">
        Login required. Use the form above, or click below to open it.
      </p>
      <button type="button" onClick={() => openAuthModal("login")} className="btn-army">
        Open login
      </button>
      <Link href="/" className="btn-army-outline">
        Back to Home
      </Link>
    </main>
  );
}
