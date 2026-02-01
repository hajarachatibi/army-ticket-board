import { notFound } from "next/navigation";

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
            Help cover hosting &amp; maintenance costs.
          </p>

          <div className="mt-6 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-300">
            <p className="font-semibold text-army-purple">Help us keep the app running.</p>
            <p className="mt-1">
              Donations are <strong>optional</strong>, and secure.
            </p>
            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
              PayPal integration is not enabled yet. This page will be updated once it’s configured.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

