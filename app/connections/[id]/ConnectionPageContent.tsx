"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import RequireAuth from "@/components/RequireAuth";
import UserReportModal from "@/components/UserReportModal";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { acceptConnectionAgreement, sellerRespondConnection, setComfortDecision, setSocialShareDecision, submitBondingAnswers } from "@/lib/supabase/listings";

type ConnectionRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  stage: string;
  stage_expires_at: string;
  bonding_question_ids: string[];
  buyer_bonding_submitted_at: string | null;
  seller_bonding_submitted_at: string | null;
  buyer_comfort: boolean | null;
  seller_comfort: boolean | null;
  buyer_social_share: boolean | null;
  seller_social_share: boolean | null;
  buyer_agreed: boolean;
  seller_agreed: boolean;
};

type Preview = any;

export default function ConnectionPageContent() {
  const params = useParams<{ id: string }>();
  const connectionId = String(params.id ?? "");
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnectionRow | null>(null);

  const [bondingQuestions, setBondingQuestions] = useState<Array<{ id: string; prompt: string }>>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const isBuyer = useMemo(() => !!user && conn?.buyer_id === user.id, [conn?.buyer_id, user]);
  const isSeller = useMemo(() => !!user && conn?.seller_id === user.id, [conn?.seller_id, user]);
  const otherUserId = useMemo(() => {
    if (!conn || !user) return null;
    if (conn.buyer_id === user.id) return conn.seller_id;
    if (conn.seller_id === user.id) return conn.buyer_id;
    return null;
  }, [conn, user]);
  const otherLabel = useMemo(() => {
    if (!otherUserId) return null;
    return `ARMY-${otherUserId.slice(0, 8)}`;
  }, [otherUserId]);

  const load = async () => {
    if (!connectionId) return;
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("connections")
      .select(
        "id, listing_id, buyer_id, seller_id, stage, stage_expires_at, bonding_question_ids, buyer_bonding_submitted_at, seller_bonding_submitted_at, buyer_comfort, seller_comfort, buyer_social_share, seller_social_share, buyer_agreed, seller_agreed"
      )
      .eq("id", connectionId)
      .single();

    if (e) {
      setError(e.message);
      setConn(null);
      setLoading(false);
      return;
    }
    setConn(data as any);
    setLoading(false);

    const stage = String((data as any)?.stage ?? "");
    const qIds = ((data as any)?.bonding_question_ids ?? []) as string[];
    if (stage === "bonding" && qIds.length > 0) {
      const { data: qs } = await supabase.from("bonding_questions").select("id, prompt").in("id", qIds);
      setBondingQuestions(((qs ?? []) as any[]).map((q) => ({ id: String(q.id), prompt: String(q.prompt ?? "") })));
    } else {
      setBondingQuestions([]);
    }

    if (["preview", "comfort", "social", "agreement", "chat_open", "ended", "expired"].includes(stage)) {
      const { data: p, error: pe } = await supabase.rpc("get_connection_preview", { p_connection_id: connectionId });
      if (!pe) setPreview(p);
    } else {
      setPreview(null);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, user?.id]);

  const expiresLabel = useMemo(() => {
    if (!conn?.stage_expires_at) return "";
    const d = new Date(conn.stage_expires_at);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  }, [conn?.stage_expires_at]);

  const doSellerRespond = async (accept: boolean) => {
    if (!conn) return;
    setSubmitting(true);
    setError(null);
    const { error: e } = await sellerRespondConnection(conn.id, accept);
    setSubmitting(false);
    if (e) setError(e);
    else void load();
  };

  const canSubmitBonding = useMemo(() => {
    if (!conn) return false;
    if (submitting) return false;
    if (conn.stage !== "bonding") return false;
    const alreadySubmitted = isBuyer ? !!conn.buyer_bonding_submitted_at : isSeller ? !!conn.seller_bonding_submitted_at : false;
    if (alreadySubmitted) return false;
    if (bondingQuestions.length !== 3) return false;
    return bondingQuestions.every((q) => (answers[q.id] ?? "").trim().length > 0);
  }, [answers, bondingQuestions, conn, isBuyer, isSeller, submitting]);

  const doSubmitBonding = async () => {
    if (!conn || !canSubmitBonding) return;
    setSubmitting(true);
    setError(null);
    const payload: Record<string, string> = {};
    for (const q of bondingQuestions) payload[q.id] = (answers[q.id] ?? "").trim();
    const { error: e } = await submitBondingAnswers(conn.id, payload);
    setSubmitting(false);
    if (e) setError(e);
    else void load();
  };

  const doComfort = async (comfort: boolean) => {
    if (!conn) return;
    setSubmitting(true);
    setError(null);
    const { error: e } = await setComfortDecision(conn.id, comfort);
    setSubmitting(false);
    if (e) setError(e);
    else void load();
  };

  const doSocial = async (share: boolean) => {
    if (!conn) return;
    setSubmitting(true);
    setError(null);
    const { error: e } = await setSocialShareDecision(conn.id, share);
    setSubmitting(false);
    if (e) setError(e);
    else void load();
  };

  const doAgreement = async () => {
    if (!conn) return;
    setSubmitting(true);
    setError(null);
    const { error: e } = await acceptConnectionAgreement(conn.id);
    setSubmitting(false);
    if (e) setError(e);
    else void load();
  };


  return (
    <RequireAuth>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-army-purple">Connection</h1>
        <div className="flex gap-2">
          <Link href="/tickets" className="btn-army-outline">
            Back
          </Link>
          <button
            type="button"
            className="btn-army-outline"
            onClick={() => setReportOpen(true)}
            disabled={!otherUserId || submitting}
            title={!otherUserId ? "Only connection participants can report." : "Report this user"}
          >
            Report user
          </button>
          <button type="button" className="btn-army-outline" onClick={() => void load()} disabled={submitting}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : !conn ? (
        <p className="mt-6 text-neutral-500 dark:text-neutral-400">Not found.</p>
      ) : (
        <>
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Stage</p>
                <p className="mt-1 font-display text-xl font-bold text-army-purple">{conn.stage}</p>
                {!!expiresLabel && (
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    Expires: <span className="font-semibold">{expiresLabel}</span>
                  </p>
                )}
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                {isBuyer ? "You are the buyer." : isSeller ? "You are the seller." : "Participant"}
              </div>
            </div>
          </div>

          {conn.stage === "pending_seller" && (
            <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
              {isSeller ? (
                <>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    A buyer wants to connect. You have 24 hours to respond.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-army-outline" onClick={() => doSellerRespond(false)} disabled={submitting}>
                      Decline
                    </button>
                    <button type="button" className="btn-army" onClick={() => doSellerRespond(true)} disabled={submitting}>
                      Accept
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-neutral-700 dark:text-neutral-300">Waiting for the seller to accept or decline…</p>
              )}
            </div>
          )}

          {conn.stage === "bonding" && (
            <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                Answer 3 BTS bonding questions. If either side doesn’t answer within 24 hours, the connection expires.
              </p>

              {((isBuyer && conn.buyer_bonding_submitted_at) || (isSeller && conn.seller_bonding_submitted_at)) ? (
                <p className="mt-4 text-sm font-semibold text-army-purple">Thanks — you’ve submitted your answers. Waiting for the other ARMY…</p>
              ) : (
                <>
                  <div className="mt-5 space-y-4">
                    {bondingQuestions.map((q, idx) => (
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
                  <div className="mt-6 flex justify-end">
                    <button type="button" className="btn-army" onClick={doSubmitBonding} disabled={!canSubmitBonding}>
                      {submitting ? "Submitting…" : "Submit answers"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {conn.stage === "preview" && (
            <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                Preview each other’s info first. Then answer: “Are you comfortable speaking with this ARMY?”
              </p>

              {preview ? (
                <div className="mt-4 rounded-xl border border-army-purple/10 bg-army-purple/5 p-4 text-sm text-neutral-800 dark:border-army-purple/20 dark:bg-army-purple/10 dark:text-neutral-200">
                  <p className="font-semibold text-army-purple">Preview loaded.</p>
                  <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                    (Next step: we’ll format this nicely and show the full buyer/seller + listing preview exactly like the PDF.)
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">Loading preview…</p>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-army-outline" onClick={() => doComfort(false)} disabled={submitting}>
                  No
                </button>
                <button type="button" className="btn-army" onClick={() => doComfort(true)} disabled={submitting}>
                  Yes
                </button>
              </div>
            </div>
          )}

          {conn.stage === "social" && (
            <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                Share your connected social media with this ARMY? Socials are shared only if BOTH say Yes.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-army-outline" onClick={() => doSocial(false)} disabled={submitting}>
                  No
                </button>
                <button type="button" className="btn-army" onClick={() => doSocial(true)} disabled={submitting}>
                  Yes
                </button>
              </div>
            </div>
          )}

          {conn.stage === "agreement" && (
            <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                Please confirm: admins do not verify tickets, handle payments, or take responsibility for transactions.
              </p>
              <div className="mt-5 flex justify-end">
                <button type="button" className="btn-army" onClick={doAgreement} disabled={submitting}>
                  I understand and agree
                </button>
              </div>
            </div>
          )}

          {(conn.stage === "chat_open" || conn.stage === "ended") && (
            <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                Connection complete. If both agreed to share socials, you can connect there (no in-app chat).
              </p>
              <div className="mt-4 flex justify-end">
                <Link href="/tickets" className="btn-army">
                  Back to listings
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      <UserReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        reportedUserId={otherUserId}
        reportedLabel={otherLabel}
        onReported={() => setError("Thanks — your report has been submitted.")}
      />
    </RequireAuth>
  );
}

