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
              To use the app, tap <strong>Get started</strong> in the header and <strong>Continue with Google</strong> to sign in with your Gmail. One account, no password. Once signed in, use the <strong>Account</strong> menu in the header to view your email, open <strong>Settings</strong>, or <strong>Sign out</strong>.
            </p>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              After your first login, you’ll be asked to complete <strong>Finish setup</strong> (basic profile + at least one social). This is required to use listings and connections. We support only <strong>Instagram</strong> and <strong>Facebook</strong> for contact—use <strong>usernames only</strong> (no links, phone numbers, or emails).
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Home
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              The home page has a hero section and links to <strong>Tickets</strong>, <strong>Merch</strong>, and <strong>Post Listing</strong>. This is not a marketplace. Only face-value listings (tickets and merch) are allowed; non–face-value listings can be reported. See <strong>Disclaimers</strong> for safe-trading tips.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Listings &amp; connections (Tickets)
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              Under <strong>Listings</strong>, the <strong>Tickets</strong> tab lets you browse or manage ticket listings. You can switch between <strong>All Listings</strong>, <strong>My Listings</strong>, and <strong>My Connections</strong>.
            </p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              <strong>Limits:</strong> Up to <strong>3 active ticket listings</strong> at a time (sold and removed do not count). Up to <strong>5 active connection requests</strong> as a buyer; sellers can have up to <strong>3 active connections</strong> in progress. Once a seller has 3 active connections, that listing is locked to new requests. When you connect, you answer <strong>2 bonding questions</strong> once (reused for all connections) and choose whether to share socials. Contact socials are <strong>Instagram or Facebook</strong> only.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-neutral-700 dark:text-neutral-300">
              <li><strong>Post Ticket:</strong> Create a listing (up to 4 seats per listing). You may be asked to answer 2 bonding questions first if you haven’t already. Your listing appears in <strong>All Listings</strong> right away.</li>
              <li><strong>View more details:</strong> On <strong>All Listings</strong>, tap <strong>View more details</strong> on a listing to see the seller’s answers (where the ticket was bought, ticketing experience, why they’re selling).</li>
              <li><strong>CONNECT:</strong> Choose whether to share socials with the seller and answer 2 bonding questions (if first time). Then the request is sent. Seller has 24 hours to accept or decline. If accepted, you both see the match message and confirm; if you both chose to share socials, your <strong>Instagram or Facebook</strong> are shown so you can continue on social media.</li>
              <li><strong>Connection alerts:</strong> If there’s an update in one of your connections, you’ll see a <strong>purple badge</strong> on <strong>My Connections</strong>, and on the specific connection card.</li>
              <li><strong>No in-app buyer/seller chat:</strong> For ARMY safety, buyer/seller chat inside the app is not available. If you both choose to share socials and both confirm, your socials (Instagram or Facebook) will be shown so you can contact each other.</li>
              <li><strong>Report:</strong> Report suspicious or non–face-value listings. After multiple reports from different users, listings can be removed and users can be banned.</li>
            </ul>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              In <strong>My Listings</strong>, you can <strong>Edit</strong>, <strong>Delete</strong>, or <strong>Mark sold</strong>. When you mark a ticket as sold, all its active connections are ended and buyers are notified. Sold listings stay visible in browsing but can’t be connected to.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Merch
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              The <strong>Merch</strong> tab under Listings works like Tickets: you can browse <strong>All Listings</strong>, manage <strong>My Listings</strong>, and see <strong>My Connections</strong>. Same connection flow: bonding questions (reused if you’ve already answered them for tickets), social sharing (Instagram or Facebook), safety screen, and match confirmation. Only face value is accepted for merch; report non–face-value or suspicious listings.
            </p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              <strong>Differences from tickets:</strong> There is no limit on how many merch listings you can post. Connection limits (buyer/seller) do not apply to merch. When you <strong>Mark sold</strong> a merch listing, all its active connections are ended and buyers are notified, same as for tickets.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-neutral-700 dark:text-neutral-300">
              <li><strong>Post Merch Listing:</strong> Add title, description, quantity, price, category (e.g. Official Merch, Fanmade, BT21), optional filters (member, tour, condition), and up to 2 photos. You’ll be asked for bonding answers and social/safety confirmation if you haven’t already.</li>
              <li><strong>Connect:</strong> Tap a listing to view details, then <strong>Connect</strong>. You’ll see the seller’s lite profile, choose whether to share socials, and answer bonding questions if needed. Seller can accept or decline; same match and social exchange as tickets.</li>
              <li><strong>My Listings:</strong> Edit, remove, or <strong>Mark sold</strong>. Marking sold ends all connections for that listing and notifies buyers.</li>
              <li><strong>Connection alerts:</strong> Unread merch connection updates show a purple badge on the Merch <strong>My Connections</strong> tab and on each connection card.</li>
              <li><strong>Report:</strong> Use <strong>Report</strong> on any merch listing or connection for scams or policy violations.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Chatroom
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              The <strong>Chatroom</strong> has two tabs: <strong>Admin Channel</strong> (official admin announcements and replies) and <strong>Community Chat</strong> (chat with all signed-in ARMY; you choose a display name on first use, and you can react to messages, mention others with @username, and share pictures). Only signed-in users can use the Chatroom.
            </p>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              If there are new Admin Channel or Community Chat messages, you may see a <strong>purple badge</strong> on the <strong>Chatroom</strong> link in the header.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Settings
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              In <strong>Settings</strong> you can view your <strong>Account</strong> (username, email), update your <strong>Socials</strong> (Instagram or Facebook—the social you want ARMY to contact you on), and switch <strong>Appearance</strong> (dark/light mode). Use <strong>usernames only</strong> for socials—no links, phone numbers, emails, WhatsApp, or Telegram.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Header &amp; notifications
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              The header has <strong>dark/light mode</strong> and (when signed in) a <strong>notification bell</strong> and an <strong>Account</strong> menu. Notifications can include important connection updates for both tickets and merch (request received/accepted/declined, next steps, and match confirmation). Opening a notification marks it read.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Notifications and alerts — how to activate
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              To get push notifications (connection updates, listing alerts, and more) on your phone or computer, you need to enable them in the app and allow your browser or device to show notifications.
            </p>

            <h3 className="mt-6 font-display text-lg font-semibold text-army-purple">
              Step-by-step: enabling notifications
            </h3>
            <ol className="mt-2 list-inside list-decimal space-y-2 text-neutral-700 dark:text-neutral-300">
              <li>Sign in, then open <strong>Account</strong> in the header and go to <strong>Settings</strong>.</li>
              <li>Scroll to the <strong>Notifications</strong> section.</li>
              <li>Tap <strong>Allow notifications</strong>. Your browser (or device) will show a permission dialog — choose <strong>Allow</strong> so we can send push notifications to this device.</li>
              <li>Optionally, use the <strong>Notification types</strong> toggles to choose which events trigger a push (e.g. connection request received, match confirmed, story published). Tap <strong>Save notification types</strong> after changing them.</li>
              <li>For <strong>Listing alerts</strong>: turn on <strong>Enable listing alerts</strong>, set filters (continent, city, type, concert date) if you want, then tap <strong>Save listing alerts</strong>. You’ll get a push when a new or newly available listing matches your criteria.</li>
            </ol>

            <h3 className="mt-6 font-display text-lg font-semibold text-army-purple">
              iOS (iPhone / iPad)
            </h3>
            <p className="mt-2 text-neutral-700 dark:text-neutral-300">
              Push notifications on iOS only work when the app is opened <strong>from the Home Screen</strong>, not from a normal Safari tab. You must add the site to your Home Screen first.
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-700 dark:text-neutral-300">
              <li>In <strong>Safari</strong>, open Army Ticket Board and tap the <strong>Share</strong> button (square with arrow at the bottom).</li>
              <li>Scroll and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong> in the top right.</li>
              <li>Open the app by tapping its icon on your Home Screen (do not open the site in a regular Safari tab).</li>
              <li>Go to <strong>Settings → Notifications</strong> in the app and tap <strong>Allow notifications</strong>. When iOS asks, choose <strong>Allow</strong>.</li>
            </ul>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              <strong>Device settings:</strong> If you blocked notifications by mistake, go to <strong>Settings → Notifications</strong> on your iPhone/iPad, find the Army Ticket Board app (or “Web” / the site name), and turn on <strong>Allow Notifications</strong>. You can also enable sounds and badges there.
            </p>

            <h3 className="mt-6 font-display text-lg font-semibold text-army-purple">
              Android
            </h3>
            <p className="mt-2 text-neutral-700 dark:text-neutral-300">
              On Android you can use <strong>Chrome</strong> (or another browser that supports web push). When you tap <strong>Allow notifications</strong> in the app, Chrome will show a permission prompt — choose <strong>Allow</strong>.
            </p>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              <strong>Device settings:</strong> If you previously blocked notifications, open <strong>Chrome → Settings → Site settings → Notifications</strong>, find Army Ticket Board, and set it to <strong>Allow</strong>. On some devices you may also need to check <strong>Settings → Apps → Chrome → Notifications</strong> and ensure notifications are enabled for the browser.
            </p>

            <h3 className="mt-6 font-display text-lg font-semibold text-army-purple">
              Possible issues and fixes
            </h3>
            <ul className="mt-2 list-inside list-disc space-y-2 text-neutral-700 dark:text-neutral-300">
              <li><strong>“Notifications were blocked”</strong> — You chose “Block” or dismissed the prompt. Open your browser or device settings for this site and set notifications to <strong>Allow</strong>, then in the app tap <strong>Allow notifications</strong> again.</li>
              <li><strong>“Push is not supported” on iPhone/iPad</strong> — You’re likely in a normal Safari tab. Add the site to your Home Screen and open the app from the Home Screen icon, then try again in Settings.</li>
              <li><strong>No notifications arriving</strong> — Check that (1) you allowed notifications for this site in the browser/device, (2) on iOS you’re using the Home Screen app, (3) the notification types you care about are turned on in Settings, and (4) your device isn’t in Do Not Disturb or a strict battery-saver mode that blocks background delivery.</li>
              <li><strong>Listing alerts not firing</strong> — Ensure <strong>Enable listing alerts</strong> is on and you’ve tapped <strong>Save listing alerts</strong>. Alerts only run when new or newly available listings match your filters (continent, city, type, date).</li>
              <li><strong>Delivery not guaranteed</strong> — Browsers and operating systems can delay or suppress push notifications (e.g. to save battery). We send them, but we can’t guarantee every notification will appear on your device.</li>
            </ul>

            <h3 className="mt-6 font-display text-lg font-semibold text-army-purple">
              Can’t see “Allow notifications” or “How to enable in iOS”?
            </h3>
            <p className="mt-2 text-neutral-700 dark:text-neutral-300">
              Sometimes the Notifications section may not show the <strong>Allow notifications</strong> button or the <strong>How to enable in iOS</strong> button. You can still enable notifications from your device:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-700 dark:text-neutral-300">
              <li><strong>iPhone/iPad:</strong> Open <strong>Settings → Notifications</strong>. If you added the app to your Home Screen, look for the app name (or “Web” / the site name under web apps). Tap it and turn on <strong>Allow Notifications</strong>. You can also check <strong>Settings → Safari → Advanced → Website Data</strong> or <strong>Settings → Notifications</strong> for any web app entries and allow notifications there.</li>
              <li><strong>Android:</strong> Open <strong>Settings → Apps</strong> (or <strong>Applications</strong>), select <strong>Chrome</strong> (or the browser you use), then <strong>Notifications</strong> and ensure they’re allowed. For the website itself: in Chrome go to <strong>Settings → Site settings → Notifications</strong> (or <strong>Settings → Privacy and security → Site settings → Notifications</strong>) and set Army Ticket Board to <strong>Allow</strong>.</li>
            </ul>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              After allowing in device settings, reopen the app and go to <strong>Settings → Notifications</strong> again; the buttons may appear, or notifications may already work. On iOS, remember to use the app from your <strong>Home Screen</strong>, not from a Safari tab.
            </p>
          </div>

          <div className="rounded-xl border border-army-purple/20 bg-white p-6 shadow-card dark:border-army-purple/25 dark:bg-neutral-900">
            <h2 className="font-display text-xl font-bold text-army-purple">
              Home screen app — updates and limitations
            </h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              When you <strong>Add to Home Screen</strong>, your device saves the app icon and opens the site in a standalone window. New deployments don’t reach you “instantly”; here’s what to expect.
            </p>
            <h3 className="mt-6 font-display text-lg font-semibold text-army-purple">
              When do I get updates?
            </h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-700 dark:text-neutral-300">
              <li><strong>App content (pages, features, fixes):</strong> When we deploy a new version, the app <strong>checks in the background</strong>. If you have the app open, a <strong>“New version available”</strong> banner appears at the bottom — tap <strong>Refresh</strong> to load the update. We also check when you focus the app or bring it back to the foreground, and about once a minute while you’re using it.</li>
              <li><strong>Icon or name:</strong> Your phone caches these when you add to home screen. To see a new icon or name, <strong>remove the app from the home screen</strong> and <strong>Add to Home Screen</strong> again from the browser.</li>
            </ul>
            <h3 className="mt-6 font-display text-lg font-semibold text-army-purple">
              Limitations of the home screen app
            </h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-700 dark:text-neutral-300">
              <li><strong>iOS:</strong> Push notifications only work when you open the app from the <strong>Home Screen</strong>, not from a normal Safari tab. The app is still the website; it doesn’t install like a native app.</li>
              <li><strong>Manual refresh:</strong> When you open the app from the Home Screen, use the <strong>Refresh</strong> button (circular arrow) next to the logo in the header to load the latest version. Refreshing manually is a good habit so you always have the newest features and fixes.</li>
              <li><strong>Caching:</strong> The browser may cache some assets. If something looks outdated, tap the <strong>Refresh</strong> button next to the logo, or close the app completely and reopen it.</li>
              <li><strong>Refresh when prompted:</strong> When you see <strong>“New version available”</strong>, tap <strong>Refresh</strong> to get the latest app. You can tap <strong>Later</strong> to dismiss the banner; it may appear again when we check next.</li>
            </ul>
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
            <p className="mt-2 text-neutral-700 dark:text-neutral-300">
              You can also view the <a href="/user-agreement" className="font-semibold text-army-purple underline">User Agreement</a>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
