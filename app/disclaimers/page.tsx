export default function DisclaimersPage() {
  return (
    <main className="min-h-screen bg-gradient-army-subtle">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-army-purple">
          Disclaimers &amp; safe-trading tips
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Please read before buying or selling tickets.
        </p>

        <section className="mt-10 space-y-8">
          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              For buyers
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>
                <strong>Ask for proof.</strong> Request screenshots of the tickets, confirmation emails, or order details before paying.
              </li>
              <li>
                <strong>Consider a video call.</strong> Schedule a FaceTime or other video call with the seller outside the platform to verify identity and tickets.
              </li>
              <li>
                Use these steps to reduce the risk of scams. We cannot verify every listing or user.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Use PayPal Goods &amp; Services
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              Pay with <strong>PayPal Goods &amp; Services</strong> (not Friends &amp; Family) when possible. It offers purchase protection and helps resolve disputes. We do not process payments; all transactions happen between you and the other user.
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
            <h2 className="font-display text-xl font-bold text-amber-900 dark:text-amber-200">
              We are not responsible for scammers
            </h2>
            <p className="mt-3 text-amber-900 dark:text-amber-200">
              Army Ticket Board <strong>only connects ARMY</strong> with each other. We do not verify sellers, buyers, or tickets. We are <strong>not responsible</strong> for scams, fraud, or lost money. You use the platform at your own risk. Always verify the other party and use safe payment methods.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Face value only
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              Only face-value listings are allowed. Non–face-value listings will be reported and may result in a ban. Made by Army, for Army.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
