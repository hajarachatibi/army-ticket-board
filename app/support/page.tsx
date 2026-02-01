import { notFound } from "next/navigation";

import PayPalDonationWidget from "@/components/PayPalDonationWidget";

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export default function SupportPage() {
  // Hidden until PayPal is configured.
  if (!isTruthyEnv(process.env.NEXT_PUBLIC_ENABLE_SUPPORT_PAGE)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-army-purple/15 bg-white p-6 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">Support</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Help cover hosting, maintenance, and moderation costs.
          </p>

          <div className="mt-6 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-300">
            <p>Donations are optional and secure.</p>
            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
              Payments are processed by PayPal. We never receive or store your card details.
            </p>
          </div>

          <PayPalDonationWidget />
        </div>
      </div>
    </main>
  );
}

