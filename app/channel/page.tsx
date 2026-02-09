import { Suspense } from "react";
import ChatroomPageContent from "@/app/channel/ChatroomPageContent";

export const metadata = {
  title: "Chatroom | ARMY Ticket Board",
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
      <ChatroomPageContent />
    </Suspense>
  );
}

