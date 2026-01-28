"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";

export default function ChatsPage() {
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

  useEffect(() => {
    if (user) void fetchChatsForUser(user.id);
  }, [user?.id, fetchChatsForUser]);

  const chats = user ? getChatsForUser(user.id) : [];
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
          Your chat history. Open a conversation to view messages.
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
            {chats.map((c) => {
              const other =
                c.buyerId === user.id ? c.sellerUsername : c.buyerUsername;
              const last = lastMessage(c.id);
              const unread = getUnreadCount(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openChatModal(c.id)}
                    className="relative flex w-full flex-col gap-1 rounded-xl border border-army-purple/15 bg-white p-4 text-left transition-colors hover:bg-army-purple/5 dark:border-army-purple/25 dark:bg-neutral-900 dark:hover:bg-army-purple/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-army-purple">
                        {other}
                      </span>
                      <div className="flex items-center gap-2">
                        {unread > 0 && (
                          <span
                            className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-army-purple px-1.5 text-[10px] font-bold text-white shadow-sm"
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
