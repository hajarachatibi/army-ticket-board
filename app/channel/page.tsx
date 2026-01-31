import { Suspense } from "react";
import ChannelPageContent from "@/app/channel/ChannelPageContent";

export const metadata = {
  title: "Official Admin Channel | ARMY Ticket Board",
};

export const dynamic = "force-dynamic";

export default function ChannelPage() {
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
      <ChannelPageContent />
    </Suspense>
  );
}

