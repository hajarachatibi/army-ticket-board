"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import {
  getPinnedChatIds,
  MAX_PINNED,
  togglePinned as togglePinnedStorage,
} from "@/lib/chatPinned";

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
    openChatModal,
    fetchChatsForUser,
    fetchMessagesForChat,
  } = useChat();
  const openedForTicketRef = useRef<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

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
  const sortedChats = useMemo(() => {
    const byId = new Map(chats.map((c) => [c.id, c]));
    const pinned: typeof chats = [];
    for (const id of pinnedIds) {
      const c = byId.get(id);
      if (c) pinned.push(c);
    }
    const rest = chats.filter((c) => !pinnedIds.includes(c.id));
    return [...pinned, ...rest];
  }, [chats, pinnedIds]);

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
    const chat = sortedChats.find((c) => c.ticketId === ticketId);
    if (chat) {
      openedForTicketRef.current = ticketId;
      openChatModal(chat.id);
    }
  }, [user?.id, ticketId, sortedChats, openChatModal]);

  const lastMessage = (chatId: string) => {
    const msgs = getMessagesForChat(chatId);
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  };

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
          Your chat history. Open a conversation to view messages. Pin up to 3 chats to keep them at the top.
        </p>

        {chats.length === 0 ? (
          <div className="mt-8 rounded-xl border border-army-purple/15 bg-white p-8 text-center dark:border-army-purple/25 dark:bg-neutral-900">
            <p className="text-neutral-500 dark:text-neutral-400">
              No chats yet. Click Contact on a ticket to open a chat with the seller.
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
            {sortedChats.map((c) => {
              const other =
                c.buyerId === user.id ? c.sellerUsername : c.buyerUsername;
              const last = lastMessage(c.id);
              const unread = getUnreadCount(c.id);
              const isPinned = pinnedIds.includes(c.id);
              const pinDisabled = !isPinned && pinnedIds.length >= MAX_PINNED;
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
                      title={isPinned ? "Unpin" : pinnedIds.length >= MAX_PINNED ? "Unpin a chat to pin more (max 3)" : "Pin"}
                      className="flex shrink-0 items-center justify-center self-center rounded-lg p-2 text-neutral-500 transition-colors hover:bg-army-purple/10 hover:text-army-purple disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-army-purple/20 dark:hover:text-army-300"
                      aria-label={isPinned ? "Unpin chat" : "Pin chat"}
                    >
                      {isPinned ? (
                        <PinIcon filled />
                      ) : (
                        <PinIcon filled={false} />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
