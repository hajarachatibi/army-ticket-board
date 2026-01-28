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
              You can <strong>browse tickets</strong> without an account. To buy, sell, chat, or report, tap <strong>Get started</strong> in the header and <strong>Continue with Google</strong> to sign in with your Gmail. One account, no password. Use <strong>Sign out</strong> in the header to switch accounts.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Home
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              The home page has a hero section and links to <strong>Book Tickets</strong> (browse) and <strong>Sell Ticket</strong>. Only face-value tickets are allowed; non–face-value listings can be reported. See <strong>Disclaimers</strong> for safe-trading tips.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Tickets
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              Use <strong>Tickets</strong> to browse or manage your listings. Switch between <strong>Browse</strong> and <strong>My tickets</strong>.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-neutral-700 dark:text-neutral-300">
              <li><strong>Filters:</strong> Event, status, city, day, VIP, section, row, seat type, quantity.</li>
              <li><strong>Contact:</strong> Opens a chat with the seller and notifies them. You can chat right away.</li>
              <li><strong>Chat:</strong> Enabled only after you’ve bought (or once a chat exists). Use it to coordinate payment and delivery.</li>
              <li><strong>Report:</strong> Report suspicious or non–face-value listings. The seller gets an in-app notice; we review reports.</li>
              <li><strong>Sell Ticket:</strong> Add a listing (event, city, day, price, quantity, section, row, seat, type, etc.). You must be signed in.</li>
            </ul>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              In <strong>My tickets</strong>, you can <strong>Edit</strong>, <strong>Delete</strong>, or <strong>Mark sold</strong>. Use <strong>Chats</strong> to talk to buyers, and <strong>Chat</strong> when someone has contacted you. Sold tickets move to the end of the list; Contact, Chat, and Report are disabled for them.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Chats
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              <strong>Chats</strong> shows all your conversations, grouped by ticket. You can send text and images. Sellers can <strong>close</strong> a chat if you don’t agree on a deal; you can’t reopen it from that ticket. Always ask for proof (screenshots, confirmation emails) and consider a video call. Use <strong>PayPal Goods &amp; Services</strong> when paying. See <strong>Disclaimers</strong> for more.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Header &amp; notifications
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              The header has <strong>dark/light mode</strong>, a <strong>notification bell</strong> (new messages, chat opened, etc.), and your email or <strong>Get started</strong>. Use the bell to jump to the relevant ticket or chat.
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
        </section>
      </div>
    </main>
  );
}
