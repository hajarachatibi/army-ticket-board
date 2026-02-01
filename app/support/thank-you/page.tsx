import Link from "next/link";

export default function ThankYouPage({
  searchParams,
}: {
  searchParams: { orderId?: string; captureId?: string };
}) {
  const orderId = (searchParams.orderId || "").trim();
  const captureId = (searchParams.captureId || "").trim();

  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-army-purple/15 bg-white p-6 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">Thank you</h1>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            Your donation was confirmed. We appreciate your support.
          </p>

          {(orderId || captureId) && (
            <div className="mt-6 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 text-xs text-neutral-700 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-300">
              {orderId && (
                <p>
                  <span className="font-semibold text-army-purple">Order ID:</span> {orderId}
                </p>
              )}
              {captureId && (
                <p className="mt-1">
                  <span className="font-semibold text-army-purple">Capture ID:</span> {captureId}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/support" className="btn-army-outline">
              Back to Support
            </Link>
            <Link href="/" className="btn-army">
              Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

