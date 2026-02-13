import { Suspense } from "react";
import MerchConnectionPageContent from "@/app/merch/connections/[id]/MerchConnectionPageContent";

export const dynamic = "force-dynamic";

export default function MerchConnectionPage() {
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
      <MerchConnectionPageContent />
    </Suspense>
  );
}
