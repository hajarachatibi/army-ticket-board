"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AdminChatModal from "@/components/AdminChatModal";
import { useAuth } from "@/lib/AuthContext";
import { fetchMyAdminChats, type AdminChatListItem } from "@/lib/supabase/adminChats";

export default function AdminChatsPageContent() {
  const router = useRouter();
  const { user, isLoggedIn, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminChatListItem[]>([]);
  const [active, setActive] = useState<AdminChatListItem | null>(null);

  const load = async () => {
    if (!isLoggedIn || !user) return;
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchMyAdminChats();
    if (e) setError(e);
    // Users should only see their own admin chats (where they are NOT the admin).
    setItems((data ?? []).filter((x) => !x.isAdmin));
    setLoading(false);
  };

  useEffect(() => {
    if (isLoggedIn && user && isAdmin) {
      // Admins already have the admin-only chats page.
      router.replace("/chats");
    }
  }, [isAdmin, isLoggedIn, router, user]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user?.id, isAdmin]);

  if (!isLoggedIn || !user) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-army-purple">Admin chats</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Private messages between you and the official admins.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/channel" className="btn-army-outline">
            Admin Channel
          </Link>
          <button type="button" className="btn-army-outline" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-center text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-army-purple/15 bg-white p-8 text-center dark:border-army-purple/25 dark:bg-neutral-900">
          <p className="text-neutral-500 dark:text-neutral-400">
            No admin chats yet. If an admin needs to contact you, the conversation will appear here.
          </p>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            For announcements, check the <Link href="/channel" className="font-semibold text-army-purple underline">Admin Channel</Link>.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full rounded-2xl border border-army-purple/15 bg-white p-4 text-left shadow-sm transition-colors hover:bg-army-purple/5 dark:border-army-purple/25 dark:bg-neutral-900 dark:hover:bg-army-purple/10"
                onClick={() => setActive(item)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-army-purple">{item.otherEmail || "Admin"}</p>
                    <p className="mt-1 truncate text-sm text-neutral-600 dark:text-neutral-400">
                      {item.lastText ?? (item.status === "closed" ? "Closed" : "No messages yet")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === "open"
                        ? "bg-army-200/50 text-army-800 dark:bg-army-300/30 dark:text-army-200"
                        : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400"
                    }`}
                  >
                    {item.status === "open" ? "Open" : "Closed"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <AdminChatModal
          adminChat={{
            id: active.id,
            adminId: active.otherUserId ?? "",
            userId: user.id,
            createdAt: active.createdAt,
            status: active.status,
            closedAt: active.closedAt,
          }}
          userEmail={active.otherEmail || "Admin"}
          youAreAdmin={false}
          otherShowAdminBadge={active.otherShowAdminBadge}
          otherUserId={active.otherUserId}
          onClose={() => {
            setActive(null);
            void load();
          }}
          onStatusChange={() => void load()}
        />
      )}
    </>
  );
}

