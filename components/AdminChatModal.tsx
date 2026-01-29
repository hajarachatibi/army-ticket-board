"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchAdminChatMessages,
  sendAdminChatMessage,
  updateAdminChatClosed,
  updateAdminChatReopened,
  type AdminChat,
  type AdminChatMessage,
} from "@/lib/supabase/adminChats";

type Props = {
  adminChat: AdminChat;
  userEmail: string;
  onClose: () => void;
  onStatusChange?: () => void;
  /** When opening from Chats list we use minimal adminChat; pass true if current user is the admin. */
  youAreAdmin?: boolean;
  /** When true, show "Admin" badge next to messages from the other user (e.g. achatibihajar). */
  otherShowAdminBadge?: boolean;
};

export default function AdminChatModal({ adminChat, userEmail, onClose, onStatusChange, youAreAdmin, otherShowAdminBadge }: Props) {
  const { user } = useAuth();
  const { setLastReadAt } = useChat();
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"open" | "closed">(adminChat.status ?? "open");
  const listRef = useRef<HTMLUListElement>(null);

  const isAdmin = youAreAdmin ?? (!!user && !!adminChat.adminId && adminChat.adminId === user.id);
  const isOpen = status === "open";

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const { data, error: err } = await fetchAdminChatMessages(adminChat.id);
    if (!silent) setLoading(false);
    if (err) setError(err);
    else if (data) setMessages(data);
  }, [adminChat.id]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (adminChat.id) setLastReadAt(adminChat.id);
  }, [adminChat.id, setLastReadAt]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`admin_chat_${adminChat.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_chat_messages" },
        (payload) => {
          const row = payload.new as {
            id: string;
            admin_chat_id: string;
            sender_id: string;
            sender_username: string;
            text: string;
            created_at: string;
          };
          if (row.admin_chat_id !== adminChat.id) return;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    adminChatId: row.admin_chat_id,
                    senderId: row.sender_id,
                    senderUsername: row.sender_username,
                    text: row.text,
                    createdAt: row.created_at,
                  },
                ]
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminChat.id]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !user || sending || !isOpen) return;
    setSending(true);
    setDraft("");
    setError(null);
    const { data, error: err } = await sendAdminChatMessage({
      adminChatId: adminChat.id,
      senderId: user.id,
      senderUsername: user.username || user.email || "Admin",
      text,
    });
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    void loadMessages(true);
  }, [adminChat.id, draft, user, sending, loadMessages, isOpen]);

  const handleStop = useCallback(async () => {
    if (!isAdmin || !isOpen) return;
    const { error: err } = await updateAdminChatClosed(adminChat.id);
    if (err) setError(err);
    else {
      setStatus("closed");
      onStatusChange?.();
    }
  }, [adminChat.id, isAdmin, isOpen, onStatusChange]);

  const handleReactivate = useCallback(async () => {
    if (!isAdmin || isOpen) return;
    const { error: err } = await updateAdminChatReopened(adminChat.id);
    if (err) setError(err);
    else {
      setStatus("open");
      onStatusChange?.();
    }
  }, [adminChat.id, isAdmin, isOpen, onStatusChange]);

  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-chat-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl cursor-default flex-col rounded-2xl border border-army-purple/20 bg-white shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-army-purple/15 p-4 dark:border-army-purple/25">
          <h2 id="admin-chat-modal-title" className="font-display text-xl font-bold text-army-purple">
            Chat with {userEmail}
          </h2>
        </div>

        <ul
          ref={listRef}
          className="flex-1 space-y-3 overflow-y-auto p-4"
        >
          {loading ? (
            <li className="text-center text-sm text-neutral-500 dark:text-neutral-400">Loading…</li>
          ) : error ? (
            <li className="text-center text-sm text-red-600 dark:text-red-400">{error}</li>
          ) : messages.length === 0 ? (
            <li className="text-center text-sm text-neutral-500 dark:text-neutral-400">
              No messages yet. Send one below.
            </li>
          ) : (
            messages.map((m) => {
              const isMe = m.senderId === user.id;
              return (
                <li
                  key={m.id}
                  className={`rounded-lg px-3 py-2 ${
                    isMe
                      ? "ml-8 bg-army-purple/10 dark:bg-army-purple/20"
                      : "mr-8 bg-neutral-100 dark:bg-neutral-800"
                  }`}
                >
                  <p className="text-xs font-semibold text-army-purple">
                    {isMe ? "You" : m.senderUsername}
                    {!isMe && otherShowAdminBadge && (
                      <span className="ml-1.5 rounded bg-army-purple/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-army-purple">Admin</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-800 dark:text-neutral-200">{m.text}</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {new Date(m.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </li>
              );
            })
          )}
        </ul>

        <div className="border-t border-army-purple/15 p-4 dark:border-army-purple/25 space-y-2">
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          {isOpen && (
            <div className="flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message…"
                className="input-army flex-1"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="btn-army shrink-0 disabled:opacity-50"
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
          )}
          {!isOpen && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">This chat has been stopped.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {isAdmin && isOpen && (
              <button
                type="button"
                onClick={handleStop}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Stop the chat
              </button>
            )}
            {isAdmin && !isOpen && (
              <button
                type="button"
                onClick={handleReactivate}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-army-purple hover:bg-army-purple/10 dark:text-army-300 dark:hover:bg-army-purple/20"
              >
                Reactivate
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-army-outline flex-1">
              {isOpen ? "Close" : "Back"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
