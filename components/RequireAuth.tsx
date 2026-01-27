"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn) router.replace("/login");
  }, [isLoggedIn, isLoading, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-army-subtle">
        <p className="text-army-purple">Loading…</p>
      </main>
    );
  }

  if (!isLoggedIn) return null;

  return <>{children}</>;
}
