export default function UserManualPage() {
  return (
    <main className="min-h-screen bg-gradient-army-subtle">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-army-purple">
          User manual
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          How to use Army Ticket Board. Made by Army, for Army.
        </p>

        <section className="mt-10 space-y-8">
          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Getting started
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              To use the app, tap <strong>Get started</strong> in the header and <strong>Continue with Google</strong> to sign in with your Gmail. One account, no password. Use <strong>Sign out</strong> in the header to switch accounts.
            </p>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              After your first login, you’ll be asked to complete <strong>Finish setup</strong> (basic profile + at least one social). This is required to use listings and connections.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Home
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              The home page has a hero section and links to browse <strong>Listings</strong>. This is not a marketplace. Only face-value listings are allowed; non–face-value listings can be reported. See <strong>Disclaimers</strong> for safe-trading tips.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Listings &amp; connections
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              Use <strong>Listings</strong> to browse or manage your posts. You can switch between <strong>All Listings</strong>, <strong>My Listings</strong>, and <strong>My Connections</strong>.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-neutral-700 dark:text-neutral-300">
              <li><strong>Post Ticket:</strong> Create a listing (up to 4 seats per listing). New listings appear after a short delay.</li>
              <li><strong>CONNECT:</strong> Starts a connection with the seller. You’ll go through steps (accept/decline, bonding questions, comfort checks, socials decision, agreement).</li>
              <li><strong>No in-app buyer/seller chat:</strong> If you both agree to share socials, you continue on social media.</li>
              <li><strong>Report:</strong> Report suspicious or non–face-value listings. After multiple reports from different users, listings can be removed and users can be banned.</li>
            </ul>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              In <strong>My Listings</strong>, you can <strong>Edit</strong>, <strong>Delete</strong>, or <strong>Mark sold</strong>. Sold listings stay visible in browsing but can’t be connected to.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Admin Channel
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              Use the <strong>Admin Channel</strong> to message the official admins. This is the only in-app messaging channel.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Header &amp; notifications
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              The header has <strong>dark/light mode</strong>, a <strong>notification bell</strong>, and your email or <strong>Get started</strong>. Notifications can include admin channel updates and important listing/connection updates.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Disclaimers
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              We only connect ARMY. We don’t verify users or tickets and aren’t responsible for scams. Read the <strong>Disclaimers</strong> page for buyer tips, PayPal guidance, and face-value rules.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Privacy &amp; Terms
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              Please read our <a href="/privacy-policy" className="font-semibold text-army-purple underline">Privacy Policy</a> and{" "}
              <a href="/terms" className="font-semibold text-army-purple underline">Terms and Conditions</a>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
