"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn) router.replace("/login");
  }, [isLoggedIn, isLoading, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isLoading || !isLoggedIn) return;
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      if (path.startsWith("/onboarding")) return;
      const { data, error } = await supabase.rpc("my_onboarding_status");
      if (cancelled) return;
      if (error) return; // fail-open (don't brick the app if RPC not deployed yet)
      const onboardingCompleted = Boolean((data as any)?.onboarding_completed);
      const termsAccepted = Boolean((data as any)?.terms_accepted);
      const userAgreementAccepted = Boolean((data as any)?.user_agreement_accepted);
      if (!onboardingCompleted || !termsAccepted || !userAgreementAccepted) {
        const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/tickets";
        router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
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
