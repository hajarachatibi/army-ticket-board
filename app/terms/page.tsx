import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-army-purple/15 bg-white p-6 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">Terms and Conditions</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            By using Army Ticket Board, you agree to these terms.
          </p>

          <div className="mt-6 space-y-6 text-sm text-neutral-700 dark:text-neutral-300">
            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">What this app is</h2>
              <p className="mt-2">
                Army Ticket Board is a community tool to connect buyers and sellers. We are not a payment processor and we do not
                guarantee tickets, transfers, or transactions.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">User responsibilities</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>Provide accurate information when listing or messaging.</li>
                <li>Do not impersonate admins or other users.</li>
                <li>Do not post scams, phishing attempts, or requests for sensitive information.</li>
                <li>Follow safe trading practices (see Disclaimers and Safety updates).</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">Listings &amp; reviews</h2>
              <p className="mt-2">
                Listings may require admin review before becoming publicly visible. Admins can approve, reject, remove listings, or
                request additional proof.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">Moderation</h2>
              <p className="mt-2">
                We may remove content, restrict features, or ban accounts to protect users and the community (including for
                suspicious activity or rule violations).
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">No warranty</h2>
              <p className="mt-2">
                The app is provided “as is” and “as available”. We do not guarantee uninterrupted access or that every scam attempt
                can be prevented.
              </p>
            </section>
          </div>

          <div className="mt-8 flex justify-end">
            <Link href="/user-manual" className="btn-army-outline">
              Back to User manual
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

