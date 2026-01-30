"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import AdminChatModal from "@/components/AdminChatModal";
import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import {
  getPinnedChatIds,
  MAX_PINNED,
  togglePinned as togglePinnedStorage,
} from "@/lib/chatPinned";
import type { AdminChatListItem } from "@/lib/supabase/adminChats";
import type { Chat } from "@/lib/ChatContext";

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="6" r="3" />
      <path d="M12 9v11" />
    </svg>
  );
}

export default function ChatsPageContent() {
  const { user, isLoggedIn } = useAuth();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket");
  const {
    getChatsForUser,
    getMessagesForChat,
    getUnreadCount,
    getUnreadCountAdmin,
    openChatModal,
    fetchChatsForUser,
    fetchMessagesForChat,
    adminChats,
    fetchAdminChats,
  } = useChat();
  const openedForTicketRef = useRef<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [activeAdminChat, setActiveAdminChat] = useState<AdminChatListItem | null>(null);

  useEffect(() => {
    if (user) void fetchChatsForUser(user.id);
  }, [user?.id, fetchChatsForUser]);

  useEffect(() => {
    if (user?.id && typeof window !== "undefined") {
      setPinnedIds(getPinnedChatIds(user.id));
    }
  }, [user?.id]);

  const togglePin = useCallback(
    (e: React.MouseEvent, chatId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!user?.id) return;
      const { pinnedIds: next } = togglePinnedStorage(user.id, chatId, pinnedIds);
      setPinnedIds(next);
    },
    [user?.id, pinnedIds]
  );

  const chats = user ? getChatsForUser(user.id) : [];
  type ChatRow =
    | { type: "ticket"; chat: Chat }
    | { type: "admin"; item: AdminChatListItem };

  const lastMessage = useCallback(
    (chatId: string) => {
      const msgs = getMessagesForChat(chatId);
      return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    },
    [getMessagesForChat]
  );

  const sortedChats = useMemo(() => {
    const rows: ChatRow[] = [
      ...chats.map((c) => ({ type: "ticket" as const, chat: c })),
      ...adminChats.map((item: AdminChatListItem) => ({ type: "admin" as const, item })),
    ];
    const lastActivity = (r: ChatRow): number => {
      if (r.type === "ticket") {
        const last = lastMessage(r.chat.id);
        return last ? last.createdAt : r.chat.closedAt ?? r.chat.createdAt;
      }
      const at = r.item.lastMessageAt ?? r.item.createdAt;
      return new Date(at).getTime();
    };
    const idOf = (r: ChatRow): string => (r.type === "ticket" ? r.chat.id : r.item.id);
    const pinned: ChatRow[] = [];
    const rest: ChatRow[] = [];
    for (const r of rows) {
      if (pinnedIds.includes(idOf(r))) pinned.push(r);
      else rest.push(r);
    }
    rest.sort((a, b) => lastActivity(b) - lastActivity(a));
    return [...pinned, ...rest];
  }, [chats, adminChats, pinnedIds, lastMessage]);

  const chatIdsKey = useMemo(
    () => chats.map((c) => c.id).sort().join(","),
    [chats]
  );

  useEffect(() => {
    if (!chatIdsKey) return;
    chatIdsKey.split(",").forEach((id) => void fetchMessagesForChat(id));
  }, [chatIdsKey, fetchMessagesForChat]);

  useEffect(() => {
    if (!user?.id || !ticketId) return;
    if (openedForTicketRef.current === ticketId) return;
    const chat = chats.find((c) => c.ticketId === ticketId);
    if (chat) {
      openedForTicketRef.current = ticketId;
      openChatModal(chat.id);
    }
  }, [user?.id, ticketId, chats, openChatModal]);

  const hasAnyChats = chats.length > 0 || adminChats.length > 0;

  if (!isLoggedIn || !user) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h1 className="font-display text-2xl font-bold text-army-purple sm:text-3xl">
            Chat history
          </h1>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            <Link href="/login" className="font-semibold text-army-purple underline">Sign in with Google</Link> to view your chats.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-army-subtle">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-army-purple">
          Chats
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Your chat history. Open a conversation to view messages. Pin up to 4 chats to keep them at the top.
        </p>

        {!hasAnyChats ? (
          <div className="mt-8 rounded-xl border border-army-purple/15 bg-white p-8 text-center dark:border-army-purple/25 dark:bg-neutral-900">
            <p className="text-neutral-500 dark:text-neutral-400">
              No chats yet. Click Contact on a ticket to open a chat with the seller, or use Message in the admin panel to talk to users.
            </p>
            <Link
              href="/tickets"
              className="btn-army mt-4 inline-block"
            >
              Browse tickets
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {sortedChats.map((row) => {
              const id = row.type === "ticket" ? row.chat.id : row.item.id;
              const isPinned = pinnedIds.includes(id);
              const pinDisabled = !isPinned && pinnedIds.length >= MAX_PINNED;

              if (row.type === "ticket") {
                const c = row.chat;
                const other =
                  c.buyerId === user.id ? c.sellerUsername : c.buyerUsername;
                const last = lastMessage(c.id);
                const unread = getUnreadCount(c.id);
                return (
                  <li key={c.id}>
                    <div className="relative flex gap-2 rounded-xl border border-army-purple/15 bg-white transition-colors dark:border-army-purple/25 dark:bg-neutral-900">
                      <button
                        type="button"
                        onClick={() => openChatModal(c.id)}
                        className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl p-4 text-left transition-colors hover:bg-army-purple/5 dark:hover:bg-army-purple/10"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-army-purple">
                            {other}
                          </span>
                          <div className="flex items-center gap-2">
                            {unread > 0 && (
                              <span
                                className="absolute right-14 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-army-purple px-1.5 text-[10px] font-bold text-white shadow-sm"
                                aria-label={`${unread} new message${unread !== 1 ? "s" : ""}`}
                              >
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.status === "open"
                                  ? "bg-army-200/50 text-army-800 dark:bg-army-300/30 dark:text-army-200"
                                  : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400"
                              }`}
                            >
                              {c.status === "open" ? "Open" : "Closed"}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {c.ticketSummary}
                        </p>
                        {last && (
                          <p className="truncate text-xs text-neutral-500 dark:text-neutral-500">
                            {last.senderUsername}: {last.text}
                          </p>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => togglePin(e, c.id)}
                        disabled={pinDisabled}
                        title={isPinned ? "Unpin" : pinnedIds.length >= MAX_PINNED ? "Unpin a chat to pin more (max 4)" : "Pin"}
                        className="flex shrink-0 items-center justify-center self-center rounded-lg p-2 text-neutral-500 transition-colors hover:bg-army-purple/10 hover:text-army-purple disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-army-purple/20 dark:hover:text-army-300"
                        aria-label={isPinned ? "Unpin chat" : "Pin chat"}
                      >
                        {isPinned ? <PinIcon filled /> : <PinIcon filled={false} />}
                      </button>
                    </div>
                  </li>
                );
              }

              const a = row.item;
              const unreadAdmin = getUnreadCountAdmin(a.id);
              const lastPreview =
                a.lastText && a.lastSenderUsername
                  ? `${a.lastSenderUsername}: ${a.lastText}`
                  : a.lastText ?? null;
              return (
                <li key={a.id}>
                  <div className="relative flex gap-2 rounded-xl border border-army-purple/15 bg-white transition-colors dark:border-army-purple/25 dark:bg-neutral-900">
                    <button
                      type="button"
                      onClick={() => setActiveAdminChat(a)}
                      className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl p-4 text-left transition-colors hover:bg-army-purple/5 dark:hover:bg-army-purple/10"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-army-purple">
                          {a.otherEmail || "Chat"}
                        </span>
                        <div className="flex items-center gap-2">
                          {unreadAdmin > 0 && (
                            <span
                              className="absolute right-14 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-army-purple px-1.5 text-[10px] font-bold text-white shadow-sm"
                              aria-label={`${unreadAdmin} new message${unreadAdmin !== 1 ? "s" : ""}`}
                            >
                              {unreadAdmin > 99 ? "99+" : unreadAdmin}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              a.status === "open"
                                ? "bg-army-200/50 text-army-800 dark:bg-army-300/30 dark:text-army-200"
                                : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400"
                            }`}
                          >
                            {a.status === "open" ? "Open" : "Closed"}
                          </span>
                        </div>
                      </div>
                      {lastPreview && (
                        <p className="truncate text-xs text-neutral-500 dark:text-neutral-500">
                          {lastPreview}
                        </p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => togglePin(e, a.id)}
                      disabled={pinDisabled}
                      title={isPinned ? "Unpin" : pinnedIds.length >= MAX_PINNED ? "Unpin a chat to pin more (max 4)" : "Pin"}
                      className="flex shrink-0 items-center justify-center self-center rounded-lg p-2 text-neutral-500 transition-colors hover:bg-army-purple/10 hover:text-army-purple disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-army-purple/20 dark:hover:text-army-300"
                      aria-label={isPinned ? "Unpin chat" : "Pin chat"}
                    >
                      {isPinned ? <PinIcon filled /> : <PinIcon filled={false} />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {activeAdminChat && (
          <AdminChatModal
            adminChat={{
              id: activeAdminChat.id,
              adminId: "",
              userId: "",
              createdAt: activeAdminChat.createdAt,
              status: activeAdminChat.status,
              closedAt: activeAdminChat.closedAt,
            }}
            userEmail={activeAdminChat.otherEmail || "User"}
            youAreAdmin={activeAdminChat.isAdmin}
            otherShowAdminBadge={activeAdminChat.otherShowAdminBadge}
            otherUserId={activeAdminChat.otherUserId}
            onClose={() => {
              setActiveAdminChat(null);
              fetchAdminChats();
            }}
            onStatusChange={fetchAdminChats}
          />
        )}
      </div>
    </main>
  );
}
