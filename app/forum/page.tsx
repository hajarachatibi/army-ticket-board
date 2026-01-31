import ForumPageContent from "@/app/forum/ForumPageContent";
import { Suspense } from "react";

export const metadata = {
  title: "Forum | ARMY Ticket Board",
};

export const dynamic = "force-dynamic";

export default function ForumPage() {
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
      <ForumPageContent />
    </Suspense>
  );
}

