"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";
import {
  fetchActiveForumQuestions,
  fetchMyForumStatus,
  type ForumQuestion,
} from "@/lib/supabase/forum";
import TurnstileGateModal from "@/components/TurnstileGateModal";

export default function ForumPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/tickets";

  const { user, isLoggedIn, isLoading } = useAuth();
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [turnstileOpen, setTurnstileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [{ data: q, error: qErr }, { data: status, error: sErr }] = await Promise.all([
        fetchActiveForumQuestions(),
        isLoggedIn ? fetchMyForumStatus() : Promise.resolve({ data: null, error: null }),
      ]);
      if (cancelled) return;
      if (qErr) setError(qErr);
      setQuestions(q ?? []);
      if (sErr) setError(sErr);
      setAlreadySubmitted(!!status && status.needs_submit === false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const canSubmit = useMemo(() => {
    if (!user || submitting) return false;
    if (questions.length === 0) return false;
    // Require a non-empty answer for all active questions.
    return questions.every((q) => (answers[q.id] ?? "").trim().length > 0);
  }, [answers, questions, submitting, user]);

  const onSubmit = async () => {
    if (!user || !canSubmit) return;
    setTurnstileOpen(true);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-army-purple">Loading…</p>
        </div>
      </main>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-army-purple/15 bg-white p-6 text-center shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">Forum</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Please sign in to continue.
          </p>
          <Link href="/login" className="btn-army mt-6 inline-flex">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-army-purple/15 bg-white p-6 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <h1 className="font-display text-2xl font-bold text-army-purple">
            BTS Questions
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Please answer these questions to help keep the community safe. You can skip for now, but you’ll be asked again later.
          </p>

          {loading ? (
            <p className="mt-6 text-neutral-500 dark:text-neutral-400">Loading questions…</p>
          ) : questions.length === 0 ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              No questions are currently active. You can proceed.
              <div className="mt-3">
                <Link href={next} className="btn-army inline-flex">
                  Continue
                </Link>
              </div>
            </div>
          ) : alreadySubmitted ? (
            <div className="mt-6 rounded-xl border border-army-purple/15 bg-army-purple/5 px-4 py-3 text-sm text-army-purple dark:bg-army-purple/10">
              Thanks — you’ve already submitted the forum.
              <div className="mt-3">
                <Link href={next} className="btn-army inline-flex">
                  Continue
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 space-y-5">
                {questions.map((q, idx) => (
                  <div key={q.id}>
                    <label className="block text-sm font-semibold text-army-purple">
                      {idx + 1}. {q.prompt}
                    </label>
                    <textarea
                      rows={3}
                      className="input-army mt-2 resize-none"
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Type your answer…"
                    />
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                <Link href={next} className="btn-army-outline">
                  Skip for now
                </Link>
                <button
                  type="button"
                  className="btn-army"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  title={!canSubmit ? "Please answer all questions" : "Submit"}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <TurnstileGateModal
        open={turnstileOpen}
        onClose={() => setTurnstileOpen(false)}
        title="Verify to submit"
        action="army_form"
        onVerified={async (token) => {
          if (!user || !canSubmit) return;
          setSubmitting(true);
          setError(null);
          try {
            const payload: Record<string, string> = {};
            for (const q of questions) payload[q.id] = (answers[q.id] ?? "").trim();
            const res = await fetch("/api/forum/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ answers: payload, "cf-turnstile-response": token }),
            });
            const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!res.ok || !j?.ok) {
              setError(j?.error || "Submission failed");
              setSubmitting(false);
              return;
            }
            setTurnstileOpen(false);
            router.replace(next);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Submission failed");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </main>
  );
}

