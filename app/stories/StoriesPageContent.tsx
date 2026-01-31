"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { displayName } from "@/lib/displayName";
import { fetchApprovedStories, submitStory, type ArmyStory } from "@/lib/supabase/stories";

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
          <h1 className="font-display text-3xl font-bold text-army-purple">ARMY Stories</h1>
          <div className="flex gap-2">
            {isLoggedIn ? (
              <button type="button" className="btn-army" onClick={openSubmit}>
                Share your story
              </button>
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
          Community feedback and experiences. Stories are moderated. Links are not allowed.
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
                  {s.anonymous ? "Anonymous ARMY" : displayName(s.authorUsername, { viewerIsAdmin: isAdmin, subjectIsAdmin: false })} ·{" "}
                  {new Date(s.createdAt).toLocaleDateString()}
                </p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">
                  {s.body}
                </p>
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
                Share your story
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
                  <label className="block text-sm font-semibold text-army-purple">Story</label>
                  <textarea
                    className="input-army mt-1 resize-none"
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your experience…"
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
      </div>
    </main>
  );
}

