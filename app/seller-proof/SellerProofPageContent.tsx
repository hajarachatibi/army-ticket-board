"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useAuth } from "@/lib/AuthContext";

export default function SellerProofPageContent() {
  const { isLoading, isLoggedIn } = useAuth();

  const steps = useMemo(
    () => [
      "Screenshot of TM ticket page (with today’s date + your name handwritten)",
      "Screen recording scrolling TM app",
      "Screenshot of TM email (sensitive info hidden) to prove face value",
    ],
    []
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-army-purple">Loading…</p>
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-2xl font-bold text-army-purple">Seller proof</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Please sign in to continue.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/login" className="btn-army">
              Sign in
            </Link>
            <Link href="/tickets" className="btn-army-outline">
              Back
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold text-army-purple">Seller proof</h1>
          <Link href="/tickets" className="btn-army-outline">
            Back to Tickets
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-army-purple/15 bg-white/80 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-300">
          <p className="font-semibold text-army-purple">Update</p>
          <p className="mt-1">
            We merged the old “Seller proof forum” into the <strong>Sell ticket</strong> flow. Each ticket submission now requires the
            standardized Ticketmaster proofs below, and admins review them in <strong>Pending tickets</strong>.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
            If your listed price is higher due to fees, add a note during ticket submission explaining why (hide sensitive info).
          </p>
        </div>
      </div>
    </main>
  );
}

