import { Suspense } from "react";
import ConnectionPageContent from "@/app/connections/[id]/ConnectionPageContent";

export const dynamic = "force-dynamic";

export default function ConnectionPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-army-purple">Loading…</p>
          </div>
        </main>
      }
    >
      <ConnectionPageContent />
    </Suspense>
  );
}

