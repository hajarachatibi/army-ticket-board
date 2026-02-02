"use client";

import { useEffect, useMemo, useState } from "react";

import VerifiedAdminBadge from "@/components/VerifiedAdminBadge";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/lib/AuthContext";
import { displayName } from "@/lib/displayName";
import { supabase } from "@/lib/supabaseClient";
import { fetchAdminContacts } from "@/lib/supabase/liteProfile";
import {
  addChannelReply,
  adminCreateChannelPost,
  adminUpdateChannelPost,
  fetchAdminChannelPosts,
  fetchChannelReplies,
  toggleChannelReaction,
  type AdminChannelPost,
} from "@/lib/supabase/adminChannel";
import { uploadChannelImage } from "@/lib/supabase/uploadChannelImage";

type PostWithReplies = AdminChannelPost & {
  replies?: Array<{ id: string; userId: string; text: string; createdAt: string; username: string; role: string }>;
  /** Whether the current viewer reacted with 💜. */
  viewerHeart?: boolean;
};

export default function ChannelPageContent() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostWithReplies[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; username: string; email: string }>>([]);
  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [editOpen, setEditOpen] = useState<{ postId: string; text: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const adminLine = useMemo(() => {
    // Product copy (explicitly requested).
    // Keep the dynamic admin list available elsewhere on the page if desired.
    return "Hajar (achatibihajar@gmail.com) and Tom (tomkoods2020@gmail.com) are the only admins right now. If someone claims they’re an admin elsewhere, verify the Admin badge, and use the report button to report them.";
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [{ data: p, error: pErr }, { data: a, error: aErr }] = await Promise.all([
      fetchAdminChannelPosts({ limit: 50, offset: 0 }),
      fetchAdminContacts(),
    ]);
    if (pErr) setError(pErr);
    if (aErr) setError(aErr);
    // Also fetch whether the current user already reacted (💜) to each post.
    const basePosts = p.map((x) => ({ ...x })) as PostWithReplies[];
    if (user?.id && basePosts.length > 0) {
      const ids = basePosts.map((x) => x.id);
      const { data: rx } = await supabase
        .from("admin_channel_reactions")
        .select("post_id")
        .eq("user_id", user.id)
        .eq("emoji", "💜")
        .in("post_id", ids);
      const set = new Set((rx ?? []).map((r: any) => String(r.post_id)));
      setPosts(basePosts.map((x) => ({ ...x, viewerHeart: set.has(x.id) })));
    } else {
      setPosts(basePosts);
    }
    setAdmins(a ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendPost = async () => {
    if (!user || !isAdmin) return;
    const text = draft.trim();
    if (!text && !imageFile) return;
    setSending(true);
    setError(null);
    let imageUrl: string | null = null;
    if (imageFile) {
      const up = await uploadChannelImage(imageFile);
      if ("error" in up) {
        setSending(false);
        setError(up.error);
        return;
      }
      imageUrl = up.url;
    }
    const { error: e } = await adminCreateChannelPost({ authorId: user.id, text: text || " ", imageUrl });
    setSending(false);
    if (e) {
      setError(e);
      return;
    }
    setDraft("");
    setImageFile(null);
    await load();
  };

  const toggleReplies = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, replies: p.replies ? undefined : [] } : p))
    );
    const target = posts.find((p) => p.id === postId);
    if (!target || target.replies !== undefined) return;
    const { data, error: e } = await fetchChannelReplies(postId);
    if (e) {
      setError(e);
      return;
    }
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, replies: data } : p)));
  };

  const react = async (postId: string, emoji: string) => {
    if (!user) return;
    // Optimistic UI so it feels responsive and clearly toggles.
    const prev = posts;
    setPosts((cur) =>
      cur.map((p) => {
        if (p.id !== postId) return p;
        const currently = !!p.viewerHeart;
        const next = !currently;
        return {
          ...p,
          viewerHeart: next,
          reactionsCount: Math.max(0, Number(p.reactionsCount ?? 0) + (next ? 1 : -1)),
        };
      })
    );

    const { error: e } = await toggleChannelReaction({ postId, userId: user.id, emoji });
    if (e) {
      setError(e);
      setPosts(prev);
      return;
    }
    // Re-sync in background to ensure counts are accurate.
    void load();
  };

  const reply = async (postId: string, text: string) => {
    if (!user) return;
    const t = text.trim();
    if (!t) return;
    const { error: e } = await addChannelReply({ postId, userId: user.id, text: t });
    if (e) {
      setError(e);
      return;
    }
    const { data } = await fetchChannelReplies(postId);
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, replies: data } : p)));
  };

  const saveEdit = async () => {
    if (!isAdmin || !editOpen) return;
    const text = editOpen.text.trim();
    if (!text) {
      setError("Post text can't be empty.");
      return;
    }
    setEditSaving(true);
    setError(null);
    const { error: e } = await adminUpdateChannelPost({ postId: editOpen.postId, text });
    setEditSaving(false);
    if (e) {
      setError(e);
      return;
    }
    setPosts((prev) => prev.map((p) => (p.id === editOpen.postId ? { ...p, text } : p)));
    setEditOpen(null);
  };

  return (
    <RequireAuth>
      <main className="relative min-h-screen bg-[#1a0433] px-4 py-8 text-white">
        {/* BTS-ish background image layer */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: "url(/bts-hero.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Purple overlay for readability */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(196,99,255,0.55),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(255,77,166,0.25),transparent_60%),linear-gradient(180deg,rgba(26,4,51,0.85),rgba(26,4,51,0.95))]"
        />
        <div className="mx-auto max-w-3xl">
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-3xl font-bold text-white">Official Admin Channel</h1>
          </div>

          <div className="relative mt-3 rounded-2xl border border-white/25 bg-white/10 p-4 text-sm text-white backdrop-blur">
            <p className="font-semibold">Important</p>
            <p className="mt-1">{adminLine}</p>
          </div>

          {isAdmin && (
            <div className="relative mt-6 rounded-2xl border border-white/20 bg-white/10 p-5 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold text-white">Post an announcement</p>
              <textarea
                className="mt-2 w-full resize-none rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type announcement…"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="text-xs font-semibold text-white/80">
                  Add photo
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-2 block w-full text-xs text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#3b0a6f] hover:file:bg-white/90"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {imageFile && (
                  <button
                    type="button"
                    className="rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                    onClick={() => setImageFile(null)}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#3b0a6f] hover:bg-white/90 disabled:opacity-60"
                  onClick={sendPost}
                  disabled={sending || (!draft.trim() && !imageFile)}
                >
                  {sending ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="relative mt-6 space-y-4">
            {loading ? (
              <p className="text-center text-white/80">Loading…</p>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-10 text-center text-white/90 backdrop-blur">
                <p className="font-semibold">No announcements yet.</p>
                <p className="mt-1 text-sm text-white/75">This channel will always stay here for official updates.</p>
              </div>
            ) : (
              posts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-sm backdrop-blur"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {displayName(p.authorEmail || p.authorUsername, { viewerIsAdmin: isAdmin, subjectIsAdmin: true })}{" "}
                        <VerifiedAdminBadge />
                      </p>
                      <p className="mt-0.5 text-xs text-white/70">
                        {new Date(p.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {isAdmin && (
                        <button
                          type="button"
                          className="rounded-lg border border-white/25 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                          onClick={() => setEditOpen({ postId: p.id, text: p.text })}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className={`rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold transition ${
                          p.viewerHeart ? "bg-white text-[#3b0a6f]" : "bg-white/5 text-white hover:bg-white/10"
                        }`}
                        onClick={() => react(p.id, "💜")}
                        title={p.viewerHeart ? "Remove heart" : "Give a heart"}
                      >
                        💜{p.reactionsCount > 0 ? ` ${p.reactionsCount}` : ""}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-white/25 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                        onClick={() => toggleReplies(p.id)}
                      >
                        Replies{p.repliesCount > 0 ? ` (${p.repliesCount})` : ""}
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white/90">
                    {p.text}
                  </p>
                  {p.imageUrl && (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/15">
                      <img src={p.imageUrl} alt="Announcement attachment" className="h-auto w-full" />
                    </div>
                  )}

                  {p.replies !== undefined && (
                    <div className="mt-4 rounded-xl border border-white/15 bg-black/20 p-4">
                      {p.replies.length === 0 ? (
                        <p className="text-sm text-white/75">No replies yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {p.replies.map((r) => {
                            const isReplyAdmin = r.role === "admin";
                            return (
                              <div key={r.id} className="rounded-lg bg-white/10 px-3 py-2">
                                <p className="text-xs font-semibold text-white">
                                  {displayName(r.username, { viewerIsAdmin: isAdmin, subjectIsAdmin: isReplyAdmin })}
                                  {isReplyAdmin && <VerifiedAdminBadge />}
                                </p>
                                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-white/90">
                                  {r.text}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <ReplyBox onSend={(text) => reply(p.id, text)} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-post-title"
          onClick={() => setEditOpen(null)}
        >
          <div
            className="w-full max-w-2xl cursor-default rounded-2xl border border-white/25 bg-[#1a0433] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="edit-post-title" className="font-display text-xl font-bold text-white">
                Edit announcement
              </h2>
              <button
                type="button"
                className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
                onClick={() => setEditOpen(null)}
                disabled={editSaving}
              >
                Close
              </button>
            </div>

            <textarea
              className="mt-4 w-full resize-none rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
              rows={6}
              value={editOpen.text}
              onChange={(e) => setEditOpen((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
              placeholder="Update announcement text…"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                onClick={() => setEditOpen(null)}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#3b0a6f] hover:bg-white/90 disabled:opacity-60"
                onClick={saveEdit}
                disabled={editSaving || !editOpen.text.trim()}
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}

function ReplyBox({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="mt-4 flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
        placeholder="Write a reply…"
      />
      <button
        type="button"
        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#3b0a6f] hover:bg-white/90 disabled:opacity-60"
        disabled={!text.trim()}
        onClick={() => {
          const t = text;
          setText("");
          onSend(t);
        }}
      >
        Reply
      </button>
    </div>
  );
}

