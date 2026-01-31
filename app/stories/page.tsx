import { Suspense } from "react";
import StoriesPageContent from "@/app/stories/StoriesPageContent";

export const metadata = {
  title: "ARMY Stories | ARMY Ticket Board",
};

export const dynamic = "force-dynamic";

export default function StoriesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-army-purple">Loading…</p>
          </div>
        </main>
      }
    >
      <StoriesPageContent />
    </Suspense>
  );
}

