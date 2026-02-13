"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";

import PayPalDonationWidget from "@/components/PayPalDonationWidget";
import {
  fetchSupportProgress,
  supportProgressPercentage,
  type SupportProgress,
} from "@/lib/supabase/supportProgress";
import { useAuth } from "@/lib/AuthContext";

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function SupportPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const supportEnabled = isTruthyEnv(process.env.NEXT_PUBLIC_ENABLE_SUPPORT_PAGE);
  const [progress, setProgress] = useState<SupportProgress | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchSupportProgress().then(({ data }) => {
      if (!cancelled) setProgress(data ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  if (!authLoading && !supportEnabled && !isAdmin) {
    notFound();
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle flex items-center justify-center">
        <p className="text-army-purple">Loading…</p>
      </main>
    );
  }

  const showBar = progress != null && progress.targetAmountCents > 0;
  const pct = showBar ? supportProgressPercentage(progress) : 0;

  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-army-purple/15 bg-white p-6 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">Community support</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Help cover hosting, maintenance, and moderation costs.
          </p>

          {showBar && (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-army-purple">One-year costs</span>
                <span className="text-neutral-600 dark:text-neutral-400">
                  {formatCents(progress.currentAmountCents)} of {formatCents(progress.targetAmountCents)} ({pct}%)
                </span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div
                  className="h-full rounded-full bg-army-purple transition-all duration-500"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-300">
            <p>Contributions are optional and appreciated.</p>
            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
              Contributions are processed by PayPal. We never receive or store your card details.
            </p>
          </div>

          <PayPalDonationWidget />
        </div>
      </div>
    </main>
  );
}

