export const metadata = {
  title: "Maintenance | ARMY Ticket Board",
};

export default function MaintenancePage() {
  return (
    <main className="fixed inset-0 z-[9999] flex min-h-screen w-full items-center justify-center bg-black px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center">
        <img
          src="https://i.pinimg.com/originals/9a/75/9e/9a759e6ab3c3dbaa5e66505a01bdfbd3.gif"
          alt="Under maintenance"
          className="h-auto w-[min(1100px,95vw)] max-w-full rounded-2xl shadow-2xl"
        />
        <p className="max-w-3xl text-balance text-lg font-semibold text-white sm:text-2xl">
          The ARMY Ticket Board is temporarily under maintenance as we improve security. I’ll share an update once it’s
          back.
        </p>
      </div>
    </main>
  );
}

