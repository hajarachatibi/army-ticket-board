"use client";

import { useEffect, useMemo, useState } from "react";

import RequireAuth from "@/components/RequireAuth";
import VerifiedAdminBadge from "@/components/VerifiedAdminBadge";
import { useAuth } from "@/lib/AuthContext";
import {
  addUserQuestionReply,
  createUserQuestion,
  fetchUserQuestionReplies,
  fetchUserQuestions,
  type UserQuestion,
  type UserQuestionReply,
} from "@/lib/supabase/userQuestions";

type QuestionWithReplies = UserQuestion & {
  replies?: UserQuestionReply[];
};

const KEYWORD_CHIPS = [
  "connection",
  "listing",
  "stage",
  "profile",
  "filter",
  "ticket",
  "city",
  "seller",
  "buyer",
  "available",
  "locked",
  "preview",
  "request",
  "social",
  "anonymous",
];

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

function questionMatchesKeyword(q: QuestionWithReplies, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (!k) return true;
  if (q.text.toLowerCase().includes(k)) return true;
  if (q.replies?.some((r) => r.text.toLowerCase().includes(k))) return true;
  return false;
}

export default function QuestionsPageContent() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionWithReplies[]>([]);
  const [questionDraft, setQuestionDraft] = useState("");
  const [postAnonymous, setPostAnonymous] = useState(true);
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<string | null>(null);
  const [keywordFilter, setKeywordFilter] = useState("");

  const filteredQuestions = useMemo(
    () => questions.filter((q) => questionMatchesKeyword(q, keywordFilter)),
    [questions, keywordFilter]
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchUserQuestions({ limit: 50, offset: 0 });
    if (e) setError(e);
    setQuestions((data ?? []).map((q) => ({ ...q })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const sendQuestion = async () => {
    if (!user) return;
    const text = questionDraft.trim();
    if (!text) return;
    setSendingQuestion(true);
    setError(null);
    const { error: e } = await createUserQuestion({ userId: user.id, text, anonymous: postAnonymous });
    setSendingQuestion(false);
    if (e) {
      setError(e);
      return;
    }
    setQuestionDraft("");
    void load();
  };

  const toggleReplies = async (questionId: string) => {
    const q = questions.find((x) => x.id === questionId);
    if (!q) return;
    if (q.replies !== undefined) {
      setQuestions((prev) => prev.map((x) => (x.id === questionId ? { ...x, replies: undefined } : x)));
      return;
    }
    setQuestions((prev) => prev.map((x) => (x.id === questionId ? { ...x, replies: [] } : x)));
    const { data, error: e } = await fetchUserQuestionReplies(questionId);
    if (e) setError(e);
    setQuestions((prev) => prev.map((x) => (x.id === questionId ? { ...x, replies: data ?? [] } : x)));
  };

  const sendReply = async (questionId: string) => {
    if (!user || !isAdmin) return;
    const text = (replyDrafts[questionId] ?? "").trim();
    if (!text) return;
    setReplySending(questionId);
    setError(null);
    const { error: e } = await addUserQuestionReply({ questionId, userId: user.id, text });
    setReplySending(null);
    setReplyDrafts((prev) => ({ ...prev, [questionId]: "" }));
    if (e) {
      setError(e);
      return;
    }
    const { data } = await fetchUserQuestionReplies(questionId);
    setQuestions((prev) => prev.map((x) => (x.id === questionId ? { ...x, replies: data ?? [] } : x)));
  };

  return (
    <RequireAuth>
      <main className="relative min-h-screen bg-[#1a0433] px-4 py-8 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: "url(/bts-hero.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(196,99,255,0.55),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(255,77,166,0.25),transparent_60%),linear-gradient(180deg,rgba(26,4,51,0.85),rgba(26,4,51,0.95))]"
        />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-white">Questions</h1>
          <p className="mt-2 text-sm text-white/80">
            Ask a question below. Admins will reply here so everyone can see the answer.
          </p>

          {/* Ask a question */}
          <div className="mt-6 rounded-2xl border border-white/20 bg-black/20 p-4">
            <label className="block text-sm font-semibold text-white">Ask a question</label>
            <textarea
              className="mt-2 w-full resize-none rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
              rows={3}
              value={questionDraft}
              onChange={(e) => setQuestionDraft(e.target.value)}
              placeholder="Type your question…"
              disabled={sendingQuestion}
            />
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-white/90">
              <input
                type="checkbox"
                checked={postAnonymous}
                onChange={(e) => setPostAnonymous(e.target.checked)}
                className="rounded border-white/30 bg-black/20 text-army-purple focus:ring-white/40"
              />
              Post anonymously (when unchecked, you’ll show as a masked name, not your email)
            </label>
            <button
              type="button"
              className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#3b0a6f] hover:bg-white/90 disabled:opacity-60"
              onClick={sendQuestion}
              disabled={sendingQuestion || !questionDraft.trim()}
            >
              {sendingQuestion ? "Sending…" : "Post question"}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
          )}

          {/* Filter by keyword */}
          <div className="mt-6 rounded-2xl border border-white/20 bg-black/20 p-4">
            <p className="mb-2 text-sm font-semibold text-white/90">Filter by keyword</p>
            <input
              type="text"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              placeholder="Type a word or pick one below…"
              className="mb-3 w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setKeywordFilter("")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  !keywordFilter.trim()
                    ? "bg-white text-[#3b0a6f]"
                    : "border border-white/30 bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                All
              </button>
              {KEYWORD_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setKeywordFilter((prev) => (prev.toLowerCase() === chip ? "" : chip))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    keywordFilter.trim().toLowerCase() === chip
                      ? "bg-white text-[#3b0a6f]"
                      : "border border-white/30 bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="mt-6 text-center text-white/70">Loading questions…</p>
          ) : questions.length === 0 ? (
            <p className="mt-6 text-center text-white/70">No questions yet. Be the first to ask!</p>
          ) : filteredQuestions.length === 0 ? (
            <p className="mt-6 text-center text-white/70">
              No questions match &quot;{keywordFilter.trim()}&quot;. Try another keyword or clear the filter.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {filteredQuestions.map((q) => (
                <li
                  key={q.id}
                  className="rounded-2xl border border-white/20 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white/90">{q.authorLabel}</p>
                      <p className="mt-1 text-sm text-white/95">{q.text}</p>
                      <p className="mt-1 text-xs text-white/60">{formatDate(q.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                      onClick={() => toggleReplies(q.id)}
                    >
                      {q.replies === undefined ? "Show replies" : "Hide replies"}
                      {q.replies && q.replies.length > 0 && ` (${q.replies.length})`}
                    </button>
                  </div>

                  {q.replies !== undefined && (
                    <div className="mt-4 border-t border-white/15 pt-4">
                      {q.replies.length === 0 ? (
                        <p className="text-xs text-white/60">No replies yet.</p>
                      ) : (
                        <ul className="space-y-3">
                          {q.replies.map((r) => (
                            <li
                              key={r.id}
                              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-white/90">
                                  {r.displayLabel}
                                </span>
                                {r.role === "admin" && (
                                  <VerifiedAdminBadge />
                                )}
                              </div>
                              <p className="mt-1 text-sm text-white/95">{r.text}</p>
                              <p className="mt-1 text-xs text-white/50">{formatDate(r.createdAt)}</p>
                            </li>
                          ))}
                        </ul>
                      )}

                      {isAdmin && (
                        <div className="mt-4 flex gap-2">
                          <input
                            className="flex-1 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                            placeholder="Reply as admin…"
                            value={replyDrafts[q.id] ?? ""}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            disabled={replySending === q.id}
                          />
                          <button
                            type="button"
                            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#3b0a6f] hover:bg-white/90 disabled:opacity-60"
                            disabled={replySending === q.id || !(replyDrafts[q.id] ?? "").trim()}
                            onClick={() => sendReply(q.id)}
                          >
                            {replySending === q.id ? "Sending…" : "Reply"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </RequireAuth>
  );
}
