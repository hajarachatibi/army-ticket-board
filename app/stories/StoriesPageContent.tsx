"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import VerifiedAdminBadge from "@/components/VerifiedAdminBadge";
import { useAuth } from "@/lib/AuthContext";
import { fetchApprovedStories, addStoryReplyAuthor, submitStory, type ArmyStory } from "@/lib/supabase/stories";
import { submitRecommendation } from "@/lib/supabase/recommendations";

export default function StoriesPageContent() {
  const { user, isLoggedIn, isLoading, isAdmin } = useAuth();
  const [stories, setStories] = useState<ArmyStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [recOpen, setRecOpen] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [recBody, setRecBody] = useState("");
  const [recSubmitting, setRecSubmitting] = useState(false);

  const [ownerReplyAdd, setOwnerReplyAdd] = useState<{ storyId: string; title: string } | null>(null);
  const [ownerReplyBody, setOwnerReplyBody] = useState("");
  const [ownerReplySaving, setOwnerReplySaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchApprovedStories();
    setLoading(false);
    if (e) setError(e);
    setStories(data);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSubmit = () => {
    if (!isLoggedIn) return;
    setSubmitOpen(true);
  };

  const openRec = () => {
    if (!isLoggedIn) return;
    setRecOpen(true);
  };

  const canSubmit = useMemo(() => {
    return !!user && title.trim().length >= 4 && body.trim().length >= 20;
  }, [user, title, body]);

  const doSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: e } = await submitStory({
      authorId: user.id,
      authorUsername: user.username || "ARMY",
      anonymous,
      title: title.trim(),
      body: body.trim(),
    });
    setSubmitting(false);
    if (e) {
      setError(e);
      return;
    }
    setSubmitOpen(false);
    setAnonymous(true);
    setTitle("");
    setBody("");
    setError("Thanks! Your story was submitted and is pending admin review.");
    void load();
  };

  const canSubmitRec = useMemo(() => {
    return !!user && recTitle.trim().length >= 4 && recBody.trim().length >= 10;
  }, [user, recTitle, recBody]);

  const doSubmitRec = async () => {
    if (!user || !canSubmitRec) return;
    setRecSubmitting(true);
    setError(null);
    const { error: e } = await submitRecommendation({
      authorId: user.id,
      title: recTitle.trim(),
      body: recBody.trim(),
    });
    setRecSubmitting(false);
    if (e) {
      setError(e);
      return;
    }
    setRecOpen(false);
    setRecTitle("");
    setRecBody("");
    setError("Thanks! Your recommendation was sent to the admins.");
  };

  const saveOwnerReply = async () => {
    if (!ownerReplyAdd || !ownerReplyBody.trim()) return;
    setOwnerReplySaving(true);
    setError(null);
    const { error: e } = await addStoryReplyAuthor(ownerReplyAdd.storyId, ownerReplyBody.trim());
    setOwnerReplySaving(false);
    if (e) setError(e);
    else {
      setOwnerReplyAdd(null);
      setOwnerReplyBody("");
      void load();
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-army-purple">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold text-army-purple">ARMY Stories & Feedback</h1>
          <div className="flex gap-2">
            {isLoggedIn ? (
              <>
                <button type="button" className="btn-army-outline" onClick={openRec}>
                  Send a recommendation
                </button>
                <button type="button" className="btn-army" onClick={openSubmit}>
                  Share your story / feedback
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-army">
                Sign in to post
              </Link>
            )}
            <Link href="/" className="btn-army-outline">
              Home
            </Link>
          </div>
        </div>

        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Community stories and feedback. Posts are moderated. Ticket resale links are not allowed. Use “Send a recommendation” only if you want to suggest a new feature or adjustment to the admins.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-army-purple/15 bg-white/80 px-4 py-3 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-300">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {loading ? (
            <p className="text-center text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : stories.length === 0 ? (
            <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-10 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
              No stories yet.
            </p>
          ) : (
            stories.map((s) => (
              <article
                key={s.id}
                className="rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900"
              >
                <h2 className="font-display text-xl font-bold text-army-purple">{s.title}</h2>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {s.authorDisplayName ?? (s.anonymous ? "Anonymous ARMY" : "ARMY")} ·{" "}
                  {new Date(s.createdAt).toLocaleDateString()}
                  {user?.id === s.authorId && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="font-medium text-army-purple underline hover:no-underline"
                        onClick={() => setOwnerReplyAdd({ storyId: s.id, title: s.title })}
                      >
                        Add your reply
                      </button>
                    </>
                  )}
                </p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">
                  {s.body}
                </p>
                {(s.replies?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-3">
                    {s.replies!.map((r) =>
                      r.replyType === "admin" ? (
                        <div
                          key={r.id}
                          className="rounded-xl border border-army-purple/20 bg-army-purple/10 p-4 dark:border-army-purple/30 dark:bg-army-purple/20"
                        >
                          <p className="flex flex-wrap items-center gap-1 text-xs font-semibold uppercase tracking-wide text-army-purple/80 dark:text-army-300/80">
                            <span>ARMY Ticket Board team</span>
                            <VerifiedAdminBadge title="Verified admin" />
                            <span className="ml-1 font-normal normal-case">
                              · {new Date(r.createdAt).toLocaleDateString()}
                            </span>
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">
                            {r.body}
                          </p>
                        </div>
                      ) : (
                        <div
                          key={r.id}
                          className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                            Story author
                            <span className="ml-2 font-normal normal-case">
                              · {new Date(r.createdAt).toLocaleDateString()}
                            </span>
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">
                            {r.body}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        {submitOpen && (
          <div
            className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-submit-title"
            onClick={() => setSubmitOpen(false)}
          >
            <div
              className="w-full max-w-xl cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="story-submit-title" className="font-display text-xl font-bold text-army-purple">
                Share your story or feedback
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                No ticket resale links. Submissions are moderated.
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="story-anon"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="h-4 w-4 rounded border-army-purple/30 text-army-purple focus:ring-army-purple"
                  />
                  <label htmlFor="story-anon" className="text-sm font-semibold text-army-purple">
                    Post anonymously
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Title</label>
                  <input className="input-army mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Story / Feedback</label>
                  <textarea
                    className="input-army mt-1 resize-none"
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Share your experience or feedback…"
                  />
                  <p className="mt-1 text-xs text-neutral-500">Minimum ~20 characters.</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="btn-army-outline" onClick={() => setSubmitOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-army" disabled={!canSubmit || submitting} onClick={doSubmit}>
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {recOpen && (
          <div
            className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rec-submit-title"
            onClick={() => setRecOpen(false)}
          >
            <div
              className="w-full max-w-xl cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="rec-submit-title" className="font-display text-xl font-bold text-army-purple">
                Send a recommendation
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Please only use this if you want to recommend a new feature or adjustment to the admins. This is not public — it goes to admins only.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Title</label>
                  <input className="input-army mt-1" value={recTitle} onChange={(e) => setRecTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Recommendation</label>
                  <textarea
                    className="input-army mt-1 resize-none"
                    rows={5}
                    value={recBody}
                    onChange={(e) => setRecBody(e.target.value)}
                    placeholder="What should we improve or add?"
                  />
                  <p className="mt-1 text-xs text-neutral-500">Minimum ~10 characters.</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="btn-army-outline" onClick={() => setRecOpen(false)} disabled={recSubmitting}>
                  Cancel
                </button>
                <button type="button" className="btn-army" disabled={!canSubmitRec || recSubmitting} onClick={doSubmitRec}>
                  {recSubmitting ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}

        {ownerReplyAdd && (
          <div
            className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => { setOwnerReplyAdd(null); setOwnerReplyBody(""); }}
          >
            <div
              className="w-full max-w-lg cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-lg font-bold text-army-purple">Your reply</h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{ownerReplyAdd.title}</p>
              <textarea
                className="input-army mt-3 min-h-[100px] w-full resize-y"
                placeholder="Add a reply to your story"
                value={ownerReplyBody}
                onChange={(e) => setOwnerReplyBody(e.target.value)}
                rows={3}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-army-outline"
                  onClick={() => { setOwnerReplyAdd(null); setOwnerReplyBody(""); }}
                  disabled={ownerReplySaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-army"
                  onClick={saveOwnerReply}
                  disabled={ownerReplySaving || !ownerReplyBody.trim()}
                >
                  {ownerReplySaving ? "Saving…" : "Add reply"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

