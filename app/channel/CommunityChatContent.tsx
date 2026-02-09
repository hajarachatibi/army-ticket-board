"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import VerifiedAdminBadge from "@/components/VerifiedAdminBadge";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchCommunityChatMessages,
  getCommunityReactionEmojis,
  sendCommunityMessage,
  setChatUsername,
  toggleCommunityReaction,
  type CommunityChatMessage,
} from "@/lib/supabase/communityChat";
import { uploadCommunityChatImage } from "@/lib/supabase/uploadChannelImage";

function renderTextWithMentions(text: string) {
  const parts = text.split(/(@[\w.-]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-semibold text-army-purple/90 dark:text-army-300">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function CommunityChatContent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatUsername, setChatUsernameState] = useState<string | null>(null);
  const [usernamePromptOpen, setUsernamePromptOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("user_profiles").select("chat_username").eq("id", user.id).single();
    const name = data?.chat_username != null && String(data.chat_username).trim() !== "" ? String(data.chat_username) : null;
    setChatUsernameState(name);
    if (!name) setUsernamePromptOpen(true);
  }, [user?.id]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchCommunityChatMessages({ limit: 100, offset: 0 });
    setLoading(false);
    if (e) setError(e);
    else setMessages(data);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("community_chat_messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_chat_messages" }, () => {
        void loadMessages();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_chat_reactions" }, () => {
        void loadMessages();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_chat_reactions" }, () => {
        void loadMessages();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id, loadMessages]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveUsername = async () => {
    const name = usernameDraft.trim();
    if (!name || !user?.id) return;
    setUsernameSaving(true);
    setError(null);
    const { error: e } = await setChatUsername(user.id, name);
    setUsernameSaving(false);
    if (e) {
      setError(e);
      return;
    }
    setChatUsernameState(name);
    setUsernamePromptOpen(false);
    setUsernameDraft("");
  };

  const send = async () => {
    if (!user?.id) return;
    const text = draft.trim();
    if (!text && !imageFile) return;
    setSending(true);
    setError(null);
    let imageUrl: string | null = null;
    if (imageFile) {
      const up = await uploadCommunityChatImage(imageFile);
      if ("error" in up) {
        setSending(false);
        setError(up.error);
        return;
      }
      imageUrl = up.url;
    }
    const { error: e } = await sendCommunityMessage({
      userId: user.id,
      text: text || " ",
      imageUrl,
    });
    setSending(false);
    if (e) {
      setError(e);
      return;
    }
    setDraft("");
    setImageFile(null);
    void loadMessages();
  };

  const react = async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    await toggleCommunityReaction({ messageId, userId: user.id, emoji });
    void loadMessages();
  };

  const emojis = getCommunityReactionEmojis();

  if (usernamePromptOpen) {
    return (
      <div className="relative mt-6 rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur">
        <h2 className="font-display text-xl font-bold text-white">Choose your chat name</h2>
        <p className="mt-2 text-sm text-white/80">
          Pick a username to show in Community Chat. You can use your profile username or something else.
        </p>
        <input
          type="text"
          value={usernameDraft}
          onChange={(e) => setUsernameDraft(e.target.value)}
          placeholder="Username"
          className="input-army mt-4 w-full bg-white/10 text-white placeholder:text-white/50"
          maxLength={50}
        />
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="btn-army rounded-lg px-4 py-2"
            onClick={saveUsername}
            disabled={usernameSaving || !usernameDraft.trim()}
          >
            {usernameSaving ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-6">
      <h2 className="font-display text-xl font-bold text-white">Community Chat</h2>
      <p className="mt-1 text-sm text-white/80">Chat with other ARMY. Be kind. Admins have a badge.</p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
        {loading ? (
          <p className="text-center text-white/80">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-white/80">No messages yet. Say hi! 💜</p>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{m.authorDisplayName}</span>
                  {m.authorIsAdmin && <VerifiedAdminBadge />}
                  <span className="text-xs text-white/60">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>
                {m.text.trim() !== "" && m.text !== " " && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/90">
                    {renderTextWithMentions(m.text)}
                  </p>
                )}
                {m.imageUrl && (
                  <div className="mt-2 overflow-hidden rounded-lg">
                    <Image
                      src={m.imageUrl}
                      alt="Shared"
                      width={320}
                      height={240}
                      className="h-auto max-h-48 w-full object-contain"
                      unoptimized
                    />
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {emojis.map((emoji) => {
                    const count = m.reactionCounts?.[emoji] ?? 0;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded-lg border border-white/25 bg-white/5 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10"
                        onClick={() => react(m.id, emoji)}
                        title={emoji}
                      >
                        {emoji}
                        {count > 0 ? ` ${count}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={listEndRef} />
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
        <textarea
          className="w-full resize-none rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message… (use @username to mention)"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold text-white/80">
            Add photo
            <input
              type="file"
              accept="image/*"
              className="ml-2 text-xs text-white/80 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#3b0a6f]"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {imageFile && (
            <button
              type="button"
              className="text-xs text-white/80 underline hover:text-white"
              onClick={() => setImageFile(null)}
            >
              Remove photo
            </button>
          )}
          <button
            type="button"
            className="btn-army rounded-lg px-4 py-2 text-sm"
            onClick={send}
            disabled={sending || (!draft.trim() && !imageFile)}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
