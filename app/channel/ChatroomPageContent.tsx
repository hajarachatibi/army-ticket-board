"use client";

import RequireAuth from "@/components/RequireAuth";
import ChannelPageContent from "@/app/channel/ChannelPageContent";

// Community Chat disabled - only showing Admin Channel
export default function ChatroomPageContent() {

  return (
    <RequireAuth>
      <main className="relative min-h-screen bg-[#1a0433] px-4 py-8 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: "url(/bts-hero.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(196,99,255,0.55),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(255,77,166,0.25),transparent_60%),linear-gradient(180deg,rgba(26,4,51,0.85),rgba(26,4,51,0.95))]"
        />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-white">Chatroom</h1>

          {/* Community Chat disabled - only showing Admin Channel */}
          <div className="mt-4 flex gap-2 rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur">
            <div className="flex-1 rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-[#3b0a6f]">
              Admin Channel
            </div>
          </div>

          <div className="mt-6">
            <ChannelPageContent />
          </div>
        </div>
      </main>
    </RequireAuth>
  );
}
