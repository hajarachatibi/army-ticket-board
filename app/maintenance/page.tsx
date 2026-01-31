export const metadata = {
  title: "Maintenance | ARMY Ticket Board",
};

export default function MaintenancePage() {
  return (
    <main className="fixed inset-0 z-[9999] flex min-h-screen w-full items-center justify-center bg-[#0a0612] px-4 py-8 text-white">
      {/* BTS-ish stage-light gradient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(196,99,255,0.45),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(255,77,166,0.25),transparent_60%),radial-gradient(circle_at_20%_30%,rgba(91,195,255,0.18),transparent_45%),linear-gradient(180deg,rgba(10,6,18,0.85),rgba(10,6,18,0.95))]"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center">
        <p className="max-w-3xl text-balance text-lg font-semibold text-white sm:text-2xl">
          The ARMY Ticket Board is temporarily under maintenance as we improve security.
        </p>
        <img
          src="https://i.pinimg.com/originals/9a/75/9e/9a759e6ab3c3dbaa5e66505a01bdfbd3.gif"
          alt="Under maintenance"
          className="h-auto w-[min(720px,95vw)] max-w-full rounded-2xl shadow-2xl"
        />

        <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-black/25 p-5 text-left text-sm text-white/90 backdrop-blur">
          <p className="text-base font-bold text-white">Important</p>
          <div className="mt-3 space-y-2">
            <p>
              Hajar (achatibihajar@gmail.com) and Tom (tomkoods2020@gmail.com) are the only admins right now. We haven't sent
              any emails to any of the users, and we are not sending anything now. Please don't reply to scammers.
            </p>
            <p>
              Admins will never ask for ticket transfer, order numbers, or payment info. Please be careful of scammers.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

