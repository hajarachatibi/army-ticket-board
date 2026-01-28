import { Suspense } from "react";

import TicketsView from "@/components/TicketsView";

function TicketsLoading() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold text-army-purple">Tickets</h1>
      <p className="mt-6 text-center text-neutral-500 dark:text-neutral-400">Loading…</p>
    </>
  );
}

export default function TicketsPage() {
  return (
    <main className="min-h-screen bg-gradient-army-subtle">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<TicketsLoading />}>
          <TicketsView />
        </Suspense>
      </div>
    </main>
  );
}
