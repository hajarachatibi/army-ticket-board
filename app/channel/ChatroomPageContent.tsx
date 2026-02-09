"use client";

import { useEffect, useRef, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import ChannelPageContent from "@/app/channel/ChannelPageContent";
import CommunityChatContent from "@/app/channel/CommunityChatContent";

type Tab = "admin" | "community";

const COMMUNITY_TAB_LAST_SEEN_KEY = (userId: string) => `army_community_tab_last_seen_${userId}`;

export default function ChatroomPageContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("admin");
  const [communityTabUnread, setCommunityTabUnread] = useState(0);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    if (!user?.id) return;
    const key = COMMUNITY_TAB_LAST_SEEN_KEY(user.id);
    if (tab === "community") {
      const now = Date.now();
      if (typeof window !== "undefined") window.localStorage.setItem(key, String(now));
      setCommunityTabUnread(0);
      return;
    }
    let cancelled = false;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    const lastSeen = Number.isFinite(Number(raw)) ? Number(raw) : 0;
    const since = new Date(lastSeen).toISOString();

    (async () => {
      const { count } = await supabase
        .from("community_chat_messages")
        .select("id", { count: "exact", head: true })
        .gt("created_at", since)
        .neq("user_id", user.id);
      if (cancelled) return;
      setCommunityTabUnread(Math.min(99, count ?? 0));
    })();

    const ch = supabase
      .channel(`chatroom_community_tab_unread_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_chat_messages" },
        (payload) => {
          if (cancelled) return;
          if (tabRef.current !== "admin") return;
          const newRow = (payload as { new?: { user_id?: string } })?.new;
          if (newRow?.user_id === user.id) return;
          setCommunityTabUnread((n) => Math.min(99, n + 1));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [user?.id, tab]);

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

          <div className="mt-4 flex gap-2 rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur">
            <button
              type="button"
              onClick={() => setTab("admin")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === "admin"
                  ? "bg-white text-[#3b0a6f]"
                  : "text-white/90 hover:bg-white/10"
              }`}
            >
              Admin Channel
            </button>
            <button
              type="button"
              onClick={() => setTab("community")}
              className={`relative flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === "community"
                  ? "bg-white text-[#3b0a6f]"
                  : "text-white/90 hover:bg-white/10"
              }`}
            >
              Community Chat
              {tab === "admin" && communityTabUnread > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-army-purple px-1 text-[10px] font-bold text-white"
                  aria-label={`${communityTabUnread} new community messages`}
                >
                  {communityTabUnread > 99 ? "99+" : communityTabUnread}
                </span>
              )}
            </button>
          </div>

          <div className="mt-6">
            {tab === "admin" && <ChannelPageContent />}
            {tab === "community" && <CommunityChatContent />}
          </div>
        </div>
      </main>
    </RequireAuth>
  );
}
