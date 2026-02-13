export const metadata = {
  title: "User Agreement | ARMY Ticket Board",
};

export default function UserAgreementPage() {
  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-army-purple/15 bg-white p-6 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-3xl font-bold text-army-purple">User Agreement</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Last updated: Feb 2, 2026
          </p>

          <div className="mt-6 space-y-6 text-sm text-neutral-700 dark:text-neutral-300">
            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">1) What this platform is (and isn’t)</h2>
              <p className="mt-2">
                ARMY Ticket Board is a community tool that helps buyers and sellers find each other for face-value BTS concert tickets and merch. We are not a ticketing company, not a broker, and not a payment processor. We do not guarantee tickets, merch, transfers, transactions, or outcomes.
              </p>
              <p className="mt-2">
                This platform is community-run. Admins do not approve or verify listings or users before listings appear.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">2) Eligibility &amp; account</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>You must be 18+ to use the app.</li>
                <li>You must complete “Finish setup” and connect at least one social account.</li>
                <li>You are responsible for activity on your account.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">3) Listings rules (tickets &amp; merch, face value only)</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Face value only:</strong> Ticket and merch listings must be at face value. Non–face-value listings may be removed.
                </li>
                <li>
                  <strong>Listings:</strong> New ticket and merch listings appear in All Listings right away (under the Tickets or Merch tab).
                </li>
                <li>
                  <strong>No guarantees:</strong> A listing is not a promise of availability or successful transfer.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">4) Connections &amp; communication (tickets &amp; merch)</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>No in-app buyer/seller chat:</strong> For community safety, buyer/seller chat inside the app is not
                  available.
                </li>
                <li>
                  <strong>Social exchange:</strong> If both sides choose to share socials and both confirm, socials are shown so you
                  can continue on social media. Contact socials are <strong>Instagram or Facebook</strong> only. This applies to both ticket and merch connections.
                </li>
                <li>
                  <strong>Locked listings:</strong> When a seller accepts a connection (tickets or merch), the listing can become locked while you go through the flow. While locked, other users can’t connect to it. Marking a listing as sold ends all its connections and notifies buyers.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">5) Safety &amp; scams</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Never share passwords, verification codes, or payment account access.</li>
                <li>Use safe payment methods (e.g., PayPal Goods &amp; Services when possible).</li>
                <li>Be cautious with brand new or empty social accounts.</li>
                <li>Admins will never ask you for ticket transfer, order numbers, or payment info.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">6) Reports &amp; enforcement</h2>
              <p className="mt-2">
                You can report listings or users for suspicious behavior, scams, abuse, or non–face-value listings. We may remove
                content, restrict features, or ban accounts to protect the community.
              </p>
              <p className="mt-2">
                To reduce ban evasion, if a banned user returns using a new account but reuses a previously banned social handle,
                we may ban that new account as well.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">7) Content you submit</h2>
              <p className="mt-2">
                You are responsible for the content you submit (ticket and merch listings, reports, and any optional submissions). Do not submit illegal content, hate/harassment, impersonation, or scams.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">8) Privacy</h2>
              <p className="mt-2">
                We collect and use information needed to operate the app (account/profile details, onboarding info, ticket and merch listings, reports, and connection status). See the Privacy Policy for details.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">9) Disclaimers &amp; limitation of liability</h2>
              <p className="mt-2">
                The app is provided “as is” and “as available.” We are not responsible for scams, fraud, chargebacks, lost money,
                ticket issues, or disputes between users. Use the platform at your own risk.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-army-purple">10) Changes</h2>
              <p className="mt-2">
                We may update this User Agreement from time to time. Continued use of the app after an update means you agree to
                the updated terms.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

