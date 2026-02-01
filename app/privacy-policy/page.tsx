import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-army-purple/15 bg-white p-6 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">Privacy Policy</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            This policy explains what we collect and how we use it.
          </p>

          <div className="mt-6 space-y-6 text-sm text-neutral-700 dark:text-neutral-300">
            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">What we collect</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>
                  <strong>Account info:</strong> your Google sign-in identity via Supabase Auth (email is used for login and admin
                  moderation).
                </li>
                <li>
                  <strong>Profile info:</strong> a username and basic account metadata needed to run the app.
                </li>
                <li>
                  <strong>Tickets:</strong> event/seat/price details for listings you submit.
                </li>
                <li>
                  <strong>Chats:</strong> messages and optional chat images that you send.
                </li>
                <li>
                  <strong>Reports:</strong> reports you submit (and optional proof images).
                </li>
                <li>
                  <strong>ARMY check form:</strong> your answers used to help keep the community safe.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">How we use data</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>To operate the app (tickets, chats, notifications).</li>
                <li>To prevent abuse and improve security (moderation, rate limiting, bot protection).</li>
                <li>To review tickets for approval before listings appear publicly.</li>
                <li>To respond to reports and enforce rules.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">Email visibility</h2>
              <p className="mt-2">
                We limit email exposure. Regular users should not see other users’ full emails in the app. Admins may see full
                emails for moderation and safety.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">Uploads (proof images/videos)</h2>
              <p className="mt-2">
                Proof uploads are stored in a private bucket. They are intended for admin review only and are served using signed
                URLs.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">Third parties</h2>
              <p className="mt-2">
                We use third-party services to run the app (hosting, authentication, database/storage). These providers process
                data as needed to deliver their services.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">Donations (optional)</h2>
              <p className="mt-2">
                If we enable the optional Support/Donations feature, payments will be processed by a third-party provider (for
                example, PayPal). We do not store your full payment details on our servers.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">Contact</h2>
              <p className="mt-2">
                If you have privacy questions, contact the admins via the Official Admin Channel or the in-app report feature.
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

