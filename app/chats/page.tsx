"use client";

import { useEffect } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";

export default function ChatsPage() {
  const { user, isLoggedIn } = useAuth();
  const { getChatsForUser, getMessagesForChat, openChatModal, fetchChatsForUser } = useChat();

  useEffect(() => {
    if (user) void fetchChatsForUser(user.id);
  }, [user?.id, fetchChatsForUser]);

  const chats = user ? getChatsForUser(user.id) : [];
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
            Please <Link href="/login" className="font-semibold text-army-purple underline">log in</Link> to view your chats.
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
              No chats yet. Request a ticket and get accepted by the seller to start chatting.
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
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openChatModal(c.id)}
                    className="flex w-full flex-col gap-1 rounded-xl border border-army-purple/15 bg-white p-4 text-left transition-colors hover:bg-army-purple/5 dark:border-army-purple/25 dark:bg-neutral-900 dark:hover:bg-army-purple/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-army-purple">
                        {other}
                      </span>
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
