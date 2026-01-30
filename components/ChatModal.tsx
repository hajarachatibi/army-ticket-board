"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import { pushPendingForUser } from "@/lib/notificationsStorage";
import VerifiedAdminBadge from "@/components/VerifiedAdminBadge";
import { supabase } from "@/lib/supabaseClient";
import { uploadChatImage } from "@/lib/supabase/uploadChatImage";
import { useRequest } from "@/lib/RequestContext";
import UserReportModal from "@/components/UserReportModal";

function safeDisplayName(name: string, allowEmail: boolean): string {
  const raw = (name ?? "").trim();
  if (!raw) return "User";
  if (allowEmail) return raw;
  if (raw.includes("@")) return raw.split("@")[0] || "User";
  return raw;
}

export default function ChatModal() {
  const { user, isAdmin } = useAuth();
  const {
    activeChatId,
    getChatById,
    getMessagesForChat,
    fetchMessagesForChat,
    addMessage,
    closeChat,
    reactivateChat,
    closeChatModal,
    setLastReadAt,
  } = useChat();
  const { closeRequest, reopenRequest } = useRequest();
  const [draft, setDraft] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [userReportOpen, setUserReportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const chat = activeChatId ? getChatById(activeChatId) : null;
  const messages = chat ? getMessagesForChat(chat.id) : [];
  const isSeller = !!user && !!chat && chat.sellerId === user.id;
  const isBuyer = !!user && !!chat && chat.buyerId === user.id;
  const otherName = chat
    ? user?.id === chat.buyerId
      ? chat.sellerUsername
      : chat.buyerUsername
    : "—";
  const otherId = chat
    ? user?.id === chat.buyerId
      ? chat.sellerId
      : chat.buyerId
    : null;
  const isOpen = !!chat && chat.status === "open";

  useEffect(() => {
    if (!chat) return;
    const ids = [chat.buyerId, chat.sellerId].filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, role")
        .in("id", ids);
      if (cancelled) return;
      if (error || !data) {
        setAdminIds(new Set());
        return;
      }
      const next = new Set<string>();
      for (const row of data as Array<{ id: string; role: string }>) {
        if (row.role === "admin") next.add(row.id);
      }
      setAdminIds(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [chat?.buyerId, chat?.sellerId, chat?.id]);

  useEffect(() => {
    if (activeChatId) fetchMessagesForChat(activeChatId);
  }, [activeChatId, fetchMessagesForChat]);

  useEffect(() => {
    if (activeChatId) setLastReadAt(activeChatId);
  }, [activeChatId, setLastReadAt]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  if (!activeChatId || !chat) return null;

  const otherIsAdmin = !!(otherId && adminIds.has(otherId));
  const otherDisplayName = isAdmin
    ? otherName
    : otherIsAdmin
      ? "Admin"
      : safeDisplayName(otherName, false);

  const sendMessage = async (text: string, imageUrl?: string) => {
    if (!user || !isOpen) return null;
    const sent = await addMessage(chat.id, user.id, user.username, text, imageUrl);
    if (sent) {
      const otherId = user.id === chat.buyerId ? chat.sellerId : chat.buyerId;
      const preview = text ? `${text.slice(0, 50)}${text.length > 50 ? "…" : ""}` : "[Image]";
      pushPendingForUser(otherId, {
        type: "new_message",
        ticketId: chat.ticketId,
        message: `New message from ${user.username}: ${preview}`,
        ticketSummary: chat.ticketSummary,
      });
    }
    return sent;
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !isOpen) return;
    setDraft("");
    await sendMessage(text);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || !isOpen || !chat) return;
    setUploadError(null);
    setUploading(true);
    const result = await uploadChatImage(chat.id, file);
    setUploading(false);
    if ("error" in result) {
      setUploadError(result.error);
      return;
    }
    await sendMessage(draft.trim() || "(Image)", result.url);
    setDraft("");
  };

  const handleCloseChat = async () => {
    if (!isSeller || !isOpen) return;
    await closeChat(chat.id);
    await closeRequest(chat.requestId, chat.ticketId);
    closeChatModal();
  };

  const handleReactivateChat = async () => {
    if (!isSeller || isOpen) return;
    await reactivateChat(chat.id);
    await reopenRequest(chat.requestId, chat.sellerId, chat.ticketId);
  };

  const handleDismiss = () => {
    closeChatModal();
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-modal-title"
      onClick={handleDismiss}
    >
      <div
        className="modal-panel flex max-h-[90vh] w-full max-w-2xl cursor-default flex-col rounded-2xl border border-army-purple/20 bg-white shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-army-purple/15 p-4 dark:border-army-purple/25">
          <h2 id="chat-modal-title" className="font-display text-xl font-bold text-army-purple">
            Chat with {otherDisplayName}
            {otherIsAdmin && <VerifiedAdminBadge />}
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {chat.ticketSummary}
            {!isOpen && " · Closed"}
          </p>
        </div>

        {isBuyer && isOpen && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              Buyer reminder
            </p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
              Ask the seller for proof, screenshots, or tickets. Consider scheduling a FaceTime or video call outside the platform before paying.{" "}
              <Link href="/disclaimers" className="font-semibold underline hover:no-underline">
                See Disclaimers
              </Link>
            </p>
          </div>
        )}

        <ul
          ref={listRef}
          className="flex-1 space-y-3 overflow-y-auto p-4"
        >
          {messages.length === 0 ? (
            <li className="text-center text-sm text-neutral-500 dark:text-neutral-400">
              No messages yet.
            </li>
          ) : (
            messages.map((m) => {
              const isMe = m.senderId === user?.id;
              const hasImage = !!m.imageUrl;
              const textOnly = m.text === "(Image)";
              const senderIsAdmin = adminIds.has(m.senderId);
              const senderLabel = isMe
                ? "You"
                : isAdmin
                  ? m.senderUsername
                  : senderIsAdmin
                    ? "Admin"
                    : safeDisplayName(m.senderUsername, false);
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
                    {senderLabel}
                    {senderIsAdmin && <VerifiedAdminBadge />}
                  </p>
                  {hasImage && (
                    <a
                      href={m.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block overflow-hidden rounded-lg border border-army-purple/20"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imageUrl}
                        alt="Chat attachment"
                        className="max-h-48 w-full object-contain"
                      />
                    </a>
                  )}
                  {(!textOnly || !hasImage) && (
                    <p className="mt-0.5 text-sm text-neutral-800 dark:text-neutral-200">
                      {m.text}
                    </p>
                  )}
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
          {uploadError && (
            <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
          )}
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-army-outline shrink-0 px-3"
                title="Attach image"
                aria-label="Attach image"
              >
                {uploading ? "…" : "📷"}
              </button>
              <button type="button" onClick={handleSend} className="btn-army" disabled={uploading}>
                Send
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUserReportOpen(true)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
              title="Report suspicious messages or behavior"
            >
              Report
            </button>
            {isSeller && isOpen && (
              <button
                type="button"
                onClick={handleCloseChat}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Stop the chat
              </button>
            )}
            {isSeller && !isOpen && (
              <button
                type="button"
                onClick={handleReactivateChat}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-army-purple hover:bg-army-purple/10 dark:text-army-300 dark:hover:bg-army-purple/20"
              >
                Reactivate
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="btn-army-outline flex-1"
            >
              {isOpen ? "Close" : "Back"}
            </button>
          </div>
        </div>
      </div>

      <UserReportModal
        open={userReportOpen}
        onClose={() => setUserReportOpen(false)}
        reportedUserId={otherId}
        reportedLabel={otherDisplayName}
        onReported={() => {}}
      />
    </div>
  );
}
