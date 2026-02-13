"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import RequireAuth from "@/components/RequireAuth";
import UserReportModal from "@/components/UserReportModal";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  acceptMerchConnectionAgreement,
  endMerchConnection,
  fetchMerchConnectionBuyerProfileForSeller,
  getMerchConnectionPreview,
  sellerRespondMerchConnection,
  setMerchComfortDecision,
  setMerchSocialShareDecision,
  submitMerchBondingAnswers,
  undoMerchConnection,
  type MerchSellerProfileForConnect,
} from "@/lib/supabase/merch";

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

type MerchConnectionRow = {
  id: string;
  merch_listing_id: string;
  buyer_id: string;
  seller_id: string;
  stage: string;
  stage_expires_at: string;
  ended_by: string | null;
  ended_at: string | null;
  stage_before_ended: string | null;
  bonding_question_ids: string[];
  buyer_bonding_submitted_at: string | null;
  seller_bonding_submitted_at: string | null;
  buyer_comfort: boolean | null;
  seller_comfort: boolean | null;
  buyer_social_share: boolean | null;
  seller_social_share: boolean | null;
  buyer_want_social_share: boolean | null;
  buyer_agreed: boolean;
  seller_agreed: boolean;
};

type Preview = any;

export default function MerchConnectionPageContent() {
  const params = useParams<{ id: string }>();
  const connectionId = String(params.id ?? "");
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusPopupClosed, setStatusPopupClosed] = useState(false);
  const [conn, setConn] = useState<MerchConnectionRow | null>(null);

  const [bondingQuestions, setBondingQuestions] = useState<Array<{ id: string; prompt: string }>>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchAck1, setMatchAck1] = useState(false);
  const [matchAck2, setMatchAck2] = useState(false);
  const [bondingIntroOpen, setBondingIntroOpen] = useState(false);
  const bondingSectionRef = useRef<HTMLDivElement | null>(null);
  const [justEndedConnectionId, setJustEndedConnectionId] = useState<string | null>(null);
  const undoEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sellerRating, setSellerRating] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const [sellerAcceptSocialShare, setSellerAcceptSocialShare] = useState<boolean | null>(null);
  const [buyerProfileForSeller, setBuyerProfileForSeller] = useState<{
    data: MerchSellerProfileForConnect | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: false, error: null });

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
      .from("merch_connections")
      .select(
        "id, merch_listing_id, buyer_id, seller_id, stage, stage_expires_at, ended_by, ended_at, stage_before_ended, bonding_question_ids, buyer_bonding_submitted_at, seller_bonding_submitted_at, buyer_comfort, seller_comfort, buyer_social_share, seller_social_share, buyer_want_social_share, buyer_agreed, seller_agreed"
      )
      .eq("id", connectionId)
      .single();

    if (e) {
      setError(e.message);
      setConn(null);
      setLoading(false);
      return;
    }
    setConn(data as MerchConnectionRow);
    setStatusPopupClosed(false);
    setBondingIntroOpen(false);
    setSellerAcceptSocialShare(null);

    const stage = String((data as any)?.stage ?? "");
    const qIds = ((data as any)?.bonding_question_ids ?? []) as string[];
    if (qIds.length > 0 && ["bonding", "buyer_bonding_v2", "preview", "social", "agreement", "chat_open", "ended", "expired"].includes(stage)) {
      const { data: qs } = await supabase.from("bonding_questions").select("id, prompt").in("id", qIds);
      const map = new Map<string, string>();
      for (const q of (qs ?? []) as any[]) map.set(String(q.id), String(q.prompt ?? ""));
      setBondingQuestions(qIds.map((id) => ({ id, prompt: map.get(id) ?? "Question" })));
    } else {
      setBondingQuestions([]);
    }

    if (["preview", "comfort", "social", "agreement", "chat_open", "ended", "expired"].includes(stage)) {
      const { data: p, error: pe } = await getMerchConnectionPreview(connectionId);
      if (pe) {
        setPreview(null);
        setError(String(pe ?? "Failed to load preview"));
      } else {
        setPreview(p);
      }
    } else {
      setPreview(null);
    }

    if (user && (data as any)?.buyer_id === user.id && ["chat_open", "ended"].includes(stage)) {
      const { data: ratingRow } = await supabase
        .from("merch_connection_ratings")
        .select("rating")
        .eq("merch_connection_id", connectionId)
        .eq("rater_id", user.id)
        .maybeSingle();
      setSellerRating((ratingRow as { rating?: number } | null)?.rating != null ? Number((ratingRow as any).rating) : null);
    } else {
      setSellerRating(null);
    }

    setLoading(false);

    if (user && String((data as any)?.seller_id ?? "") === user.id && stage === "bonding") {
      try {
        const key = `army_merch_bonding_intro_seen:${connectionId}`;
        const seen = typeof window !== "undefined" ? window.localStorage.getItem(key) : "1";
        if (!seen) setBondingIntroOpen(true);
      } catch {
        setBondingIntroOpen(true);
      }
    }
  };

  useEffect(() => {
    void load();
  }, [connectionId, user?.id]);

  useEffect(() => {
    if (!conn) return;
    if (conn.stage !== "agreement" && conn.stage !== "chat_open") return;
    setMatchOpen(true);
  }, [conn?.stage]);

  useEffect(() => {
    if (!conn || conn.stage !== "pending_seller" || !user || conn.seller_id !== user.id) {
      setBuyerProfileForSeller({ data: null, loading: false, error: null });
      return;
    }
    setBuyerProfileForSeller({ data: null, loading: true, error: null });
    let cancelled = false;
    void fetchMerchConnectionBuyerProfileForSeller(conn.id).then((res) => {
      if (!cancelled)
        setBuyerProfileForSeller({
          data: res.data ?? null,
          loading: false,
          error: res.error ?? null,
        });
    });
    return () => {
      cancelled = true;
    };
  }, [conn?.id, conn?.stage, conn?.seller_id, user?.id]);

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
    setNotice(
      accept
        ? "Saved: accepted. Next: answer bonding questions to build trust with the buyer."
        : "Saved: you declined this connection request."
    );
    const { error: e } = await sellerRespondMerchConnection(
      conn.id,
      accept,
      accept && conn.buyer_want_social_share != null ? (sellerAcceptSocialShare ?? false) : undefined
    );
    setSubmitting(false);
    if (e) setError(e);
    else void load();
  };

  const canSubmitBonding = useMemo(() => {
    if (!conn) return false;
    if (submitting) return false;
    if (conn.stage === "buyer_bonding_v2") {
      if (!isBuyer) return false;
      if (bondingQuestions.length !== 2) return false;
      return bondingQuestions.every((q) => (answers[q.id] ?? "").trim().length > 0);
    }
    if (conn.stage !== "bonding") return false;
    const alreadySubmitted = isBuyer ? !!conn.buyer_bonding_submitted_at : !!conn.seller_bonding_submitted_at;
    if (alreadySubmitted) return false;
    if (bondingQuestions.length !== 3) return false;
    return bondingQuestions.every((q) => (answers[q.id] ?? "").trim().length > 0);
  }, [answers, bondingQuestions, conn, isBuyer, isSeller, submitting]);

  const doSubmitBonding = async () => {
    if (!conn || !canSubmitBonding) return;
    setSubmitting(true);
    setError(null);
    setNotice("Saved: your bonding answers were submitted. We'll notify you when the other ARMY submits theirs.");
    const payload: Record<string, string> = {};
    for (const q of bondingQuestions) payload[q.id] = (answers[q.id] ?? "").trim();
    const { error: e } = await submitMerchBondingAnswers(conn.id, payload);
    setSubmitting(false);
    if (e) setError(e);
    else void load();
  };

  const doComfort = async (comfort: boolean) => {
    if (!conn) return;
    setSubmitting(true);
    setError(null);
    setNotice(
      comfort
        ? "Saved: you answered Yes. Once the other ARMY answers too, you'll get a notification."
        : "Saved: you answered No. This connection will end."
    );
    const { error: e } = await setMerchComfortDecision(conn.id, comfort);
    setSubmitting(false);
    if (e) setError(e);
    else void load();
  };

  const doSocial = async (share: boolean) => {
    if (!conn) return;
    setSubmitting(true);
    setError(null);
    setNotice(
      share
        ? "Saved: you chose Yes (share socials). Once the other ARMY chooses too, you'll get a notification."
        : "Saved: you chose No (do not share socials). Once the other ARMY chooses too, you'll get a notification."
    );
    const { error: e } = await setMerchSocialShareDecision(conn.id, share);
    setSubmitting(false);
    if (e) setError(e);
    else void load();
  };

  const doAgreement = async () => {
    if (!conn) return;
    setSubmitting(true);
    setError(null);
    setNotice("Saved: you confirmed.");
    const { error: e } = await acceptMerchConnectionAgreement(conn.id);
    if (e) {
      setSubmitting(false);
      setError(e);
      return;
    }
    await load();
    setSubmitting(false);
  };

  const doEndConnection = async () => {
    if (!conn) return;
    const isCancel = conn.stage === "pending_seller" && conn.buyer_id === user?.id;
    const message = isCancel
      ? "Cancel your connection request? The seller will no longer see it."
      : "End this connection? The listing will be unlocked and the other person will be notified.";
    if (!confirm(message)) return;
    setSubmitting(true);
    setError(null);
    const { error: e } = await endMerchConnection(conn.id);
    setSubmitting(false);
    if (e) setError(e);
    else {
      setNotice("Saved: this connection has been ended.");
      setJustEndedConnectionId(conn.id);
      if (undoEndTimeoutRef.current) clearTimeout(undoEndTimeoutRef.current);
      undoEndTimeoutRef.current = setTimeout(() => {
        setJustEndedConnectionId(null);
        undoEndTimeoutRef.current = null;
      }, 30_000);
      void load();
    }
  };

  const canUndoFromDetails = useMemo(() => {
    if (!conn || !user) return false;
    if (conn.stage !== "ended") return false;
    if (!conn.ended_by || conn.ended_by !== user.id) return false;
    if (!conn.ended_at) return false;
    const endedAt = new Date(conn.ended_at);
    return endedAt.getTime() > Date.now() - 60 * 60 * 1000;
  }, [conn, user]);

  const handleUndoMerchConnection = useCallback(async () => {
    const id = justEndedConnectionId ?? conn?.id;
    if (!id) return;
    setJustEndedConnectionId(null);
    if (undoEndTimeoutRef.current) {
      clearTimeout(undoEndTimeoutRef.current);
      undoEndTimeoutRef.current = null;
    }
    setError(null);
    setNotice(null);
    const { error: e } = await undoMerchConnection(id);
    if (e) setError(e);
    else setNotice("Connection restored. The other person has been notified.");
    void load();
  }, [justEndedConnectionId, conn?.id]);

  const bothAgreed = useMemo(() => Boolean(conn?.buyer_agreed) && Boolean(conn?.seller_agreed), [conn?.buyer_agreed, conn?.seller_agreed]);
  const myAgreed = useMemo(() => {
    if (!conn) return false;
    return isBuyer ? Boolean(conn.buyer_agreed) : Boolean(conn.seller_agreed);
  }, [conn, isBuyer, isSeller]);
  const otherRoleLabel = useMemo(() => {
    if (isBuyer) return "ARMY seller";
    if (isSeller) return "ARMY buyer";
    return "ARMY";
  }, [isBuyer, isSeller]);
  const meRoleLabel = useMemo(() => {
    if (isBuyer) return "ARMY buyer";
    if (isSeller) return "ARMY seller";
    return "ARMY";
  }, [isBuyer, isSeller]);
  const bothChoseShareSocials = useMemo(
    () => !!conn && conn.buyer_social_share === true && conn.seller_social_share === true,
    [conn]
  );
  const socials = useMemo(() => {
    const b = (preview as any)?.buyer ?? null;
    const s = (preview as any)?.seller ?? null;
    if (!b || !s) return null;
    const show = Boolean((preview as any)?.showSocials) || (bothChoseShareSocials && myAgreed);
    if (!show) return { show: false as const };
    return {
      show: true as const,
      buyer: {
        instagram: b.instagram ? String(b.instagram) : null,
        facebook: b.facebook ? String(b.facebook) : null,
        tiktok: b.tiktok ? String(b.tiktok) : null,
        snapchat: b.snapchat ? String(b.snapchat) : null,
      },
      seller: {
        instagram: s.instagram ? String(s.instagram) : null,
        facebook: s.facebook ? String(s.facebook) : null,
        tiktok: s.tiktok ? String(s.tiktok) : null,
        snapchat: s.snapchat ? String(s.snapchat) : null,
      },
    };
  }, [bothChoseShareSocials, myAgreed, preview]);

  const waitingBanner = useMemo(() => {
    if (!conn || !user || (!isBuyer && !isSeller)) return null;
    if (conn.stage === "pending_seller") {
      if (isBuyer) return `Request sent. Waiting for the ${otherRoleLabel} response.`;
      return null;
    }
    if (conn.stage === "bonding") {
      const mySubmitted = isBuyer ? !!conn.buyer_bonding_submitted_at : !!conn.seller_bonding_submitted_at;
      if (mySubmitted) return `Saved. Waiting for the ${otherRoleLabel} to submit bonding answers.`;
      return null;
    }
    if (conn.stage === "preview") {
      const my = isBuyer ? conn.buyer_comfort : conn.seller_comfort;
      const other = isBuyer ? conn.seller_comfort : conn.buyer_comfort;
      if (my !== null && other === null) return `Saved. Waiting for the ${otherRoleLabel} comfort answer.`;
      return null;
    }
    if (conn.stage === "social") {
      const my = isBuyer ? conn.buyer_social_share : conn.seller_social_share;
      const other = isBuyer ? conn.seller_social_share : conn.buyer_social_share;
      if (my !== null && other === null) return `Saved. Waiting for the ${otherRoleLabel} social-sharing choice.`;
      return null;
    }
    return null;
  }, [conn, isBuyer, isSeller, otherRoleLabel, user]);

  const statusPopup = useMemo(() => (conn && user && (isBuyer || isSeller) ? waitingBanner : null), [conn, isBuyer, isSeller, user, waitingBanner]);
  const myComfort = useMemo(() => (conn && (isBuyer || isSeller) ? (isBuyer ? conn.buyer_comfort : conn.seller_comfort) : null), [conn, isBuyer, isSeller]);
  const mySocialShare = useMemo(() => (conn && (isBuyer || isSeller) ? (isBuyer ? conn.buyer_social_share : conn.seller_social_share) : null), [conn, isBuyer, isSeller]);

  const stageLabel = useMemo(() => {
    const s = String(conn?.stage ?? "");
    switch (s) {
      case "pending_seller": return "Seller decision";
      case "bonding": return "Bonding questions";
      case "preview": return "Preview";
      case "social": return "Social sharing";
      case "agreement": return "Match message";
      case "chat_open": return "Connected";
      case "ended": return "Ended";
      case "declined": return "Declined";
      case "expired": return "Expired";
      case "buyer_bonding_v2": return "Bonding (buyer)";
      default: return s || "Connection";
    }
  }, [conn?.stage]);

  const progressStep = useMemo(() => {
    if (!conn) return 1;
    const s = String(conn.stage ?? "");
    if (s === "pending_seller" || s === "declined") return 1;
    if (s === "bonding" || s === "buyer_bonding_v2") return 2;
    if (s === "preview") return 3;
    if (s === "social") return 4;
    if (s === "agreement") return 5;
    if (s === "chat_open") return 6;
    if (conn.buyer_agreed || conn.seller_agreed) return 5;
    if (conn.buyer_social_share !== null || conn.seller_social_share !== null) return 4;
    if (conn.buyer_comfort !== null || conn.seller_comfort !== null) return 3;
    if (!!conn.buyer_bonding_submitted_at || !!conn.seller_bonding_submitted_at || (Array.isArray(conn.bonding_question_ids) && conn.bonding_question_ids.length > 0)) return 2;
    return 1;
  }, [conn]);

  const isTerminalStage = useMemo(() => ["declined", "ended", "expired"].includes(String(conn?.stage ?? "")), [conn?.stage]);
  const PROGRESS_STEPS = useMemo(() => [
    { id: 1, label: "Request" },
    { id: 2, label: "Bonding" },
    { id: 3, label: "Preview" },
    { id: 4, label: "Socials" },
    { id: 5, label: "Agreement" },
    { id: 6, label: "Connected" },
  ] as const, []);

  return (
    <RequireAuth>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-army-purple">Merch Connection</h1>
            {conn && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                <span className="font-semibold text-army-purple">{stageLabel}</span> · Step {progressStep} of 6
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/tickets?mode=merch" className="btn-army-outline">Back to Listings</Link>
            <button type="button" className="btn-army-outline" onClick={() => setReportOpen(true)} disabled={!otherUserId || submitting} title={!otherUserId ? "Only connection participants can report." : "Report this user"}>
              Report user
            </button>
            <button type="button" className="btn-army-outline" onClick={async () => { await load(); }} disabled={submitting || loading}>Refresh</button>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : !conn ? (
          <p className="mt-6 text-neutral-500 dark:text-neutral-400">Not found.</p>
        ) : (
          <>
            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>
            )}
            {justEndedConnectionId && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-army-purple/20 bg-army-purple/10 px-4 py-3 text-sm text-army-purple dark:bg-army-purple/20 dark:text-army-200">
                <span>Connection ended. The other person has been notified.</span>
                <button type="button" className="font-semibold underline hover:no-underline" onClick={() => void handleUndoMerchConnection()}>
                  Undo
                </button>
              </div>
            )}
            {!justEndedConnectionId && canUndoFromDetails && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-army-purple/20 bg-army-purple/10 px-4 py-3 text-sm text-army-purple dark:bg-army-purple/20 dark:text-army-200">
                <span>You ended this connection less than 1 hour ago. You can restore it if this was a mistake.</span>
                <button type="button" className="font-semibold underline hover:no-underline" onClick={() => void handleUndoMerchConnection()}>
                  Restore
                </button>
              </div>
            )}
            {notice && !error && !justEndedConnectionId && !canUndoFromDetails && (
              <div className="mt-4 rounded-xl border border-army-purple/20 bg-army-purple/5 px-4 py-3 text-sm text-army-purple dark:border-army-purple/30 dark:bg-army-purple/10">{notice}</div>
            )}

            <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Progress</p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    Step <span className="font-semibold">{progressStep}</span> of <span className="font-semibold">6</span>
                    {isTerminalStage && <> · <span className="font-semibold text-army-purple">{stageLabel}</span></>}
                  </p>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{isBuyer ? "You are the buyer." : isSeller ? "You are the seller." : "Participant"}</p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <ol className="flex min-w-[560px] items-center">
                  {PROGRESS_STEPS.map((step, idx) => {
                    const completed = step.id < progressStep;
                    const reached = step.id <= progressStep;
                    const active = step.id === progressStep && !isTerminalStage;
                    const circleCls = reached ? "bg-army-purple text-white" : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200";
                    const labelCls = reached ? "text-army-purple dark:text-army-300" : "text-neutral-500 dark:text-neutral-400";
                    return (
                      <li key={step.id} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${circleCls} ${active ? "ring-2 ring-army-purple/30 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900" : ""}`} aria-label={step.label}>
                            {completed ? "✓" : step.id}
                          </div>
                          <span className={`mt-1 text-[11px] font-semibold ${labelCls}`}>{step.label}</span>
                        </div>
                        {idx < PROGRESS_STEPS.length - 1 && (
                          <div className={`mx-2 h-0.5 flex-1 rounded-full ${completed ? "bg-army-purple" : "bg-army-purple/15 dark:bg-army-purple/25"}`} aria-hidden />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
              <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
                No in-app buyer/seller chat: if both choose to share socials and both confirm, socials will appear in the match message.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Stage</p>
                  <p className="mt-1 font-display text-xl font-bold text-army-purple">{stageLabel}</p>
                  {expiresLabel && (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Expires: <span className="font-semibold">{expiresLabel}</span></p>
                  )}
                </div>
                {conn.stage !== "ended" && conn.stage !== "expired" && conn.stage !== "declined" && (
                  <button type="button" className="btn-army-outline" onClick={doEndConnection} disabled={submitting}>
                    {conn.stage === "pending_seller" && isBuyer ? "Cancel request" : "Release / end"}
                  </button>
                )}
              </div>
            </div>

            {conn.stage === "pending_seller" && (
              <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
                {isSeller ? (
                  <>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">A buyer wants to connect. You have 24 hours to respond.</p>
                    <div className="mt-4 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 dark:border-army-purple/25 dark:bg-army-purple/10">
                      <p className="text-sm font-semibold text-army-purple">Buyer profile</p>
                      {buyerProfileForSeller.loading && <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Loading buyer profile…</p>}
                      {buyerProfileForSeller.error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{buyerProfileForSeller.error}</p>}
                      {buyerProfileForSeller.data && !buyerProfileForSeller.loading && (
                        <div className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <p><span className="font-medium text-army-purple">Username:</span> {buyerProfileForSeller.data.username}</p>
                          {buyerProfileForSeller.data.country && <p><span className="font-medium text-army-purple">Country:</span> {buyerProfileForSeller.data.country}</p>}
                          {(buyerProfileForSeller.data.armyBiasAnswer || buyerProfileForSeller.data.armyYearsArmy || buyerProfileForSeller.data.armyFavoriteAlbum) && (
                            <div className="mt-2 space-y-1">
                              <p className="font-medium text-army-purple">ARMY profile</p>
                              {buyerProfileForSeller.data.armyBiasAnswer && <div><p className="text-xs text-army-purple/80">{buyerProfileForSeller.data.armyBiasPrompt}</p><p className="whitespace-pre-wrap">{buyerProfileForSeller.data.armyBiasAnswer}</p></div>}
                              {buyerProfileForSeller.data.armyYearsArmy && <div><p className="text-xs text-army-purple/80">{buyerProfileForSeller.data.armyYearsArmyPrompt}</p><p className="whitespace-pre-wrap">{buyerProfileForSeller.data.armyYearsArmy}</p></div>}
                              {buyerProfileForSeller.data.armyFavoriteAlbum && <div><p className="text-xs text-army-purple/80">{buyerProfileForSeller.data.armyFavoriteAlbumPrompt}</p><p className="whitespace-pre-wrap">{buyerProfileForSeller.data.armyFavoriteAlbum}</p></div>}
                            </div>
                          )}
                          {buyerProfileForSeller.data.bondingAnswers.filter((b) => b.prompt || b.answer).length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="font-medium text-army-purple">Bonding answers:</p>
                              {buyerProfileForSeller.data.bondingAnswers.map((b, idx) => (
                                <div key={idx}><p className="text-xs text-army-purple/80">{b.prompt}</p><p className="whitespace-pre-wrap">{b.answer || "—"}</p></div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {conn.buyer_want_social_share != null && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-army-purple">Do you want to share socials with this buyer?</p>
                        <p className="mt-1 text-xs text-neutral-500">If you both agree, your socials will appear in the match message.</p>
                        <div className="mt-2 flex gap-4">
                          <label className="flex items-center gap-2"><input type="radio" name="merchSellerSocial" checked={sellerAcceptSocialShare === true} onChange={() => setSellerAcceptSocialShare(true)} /> Yes</label>
                          <label className="flex items-center gap-2"><input type="radio" name="merchSellerSocial" checked={sellerAcceptSocialShare === false} onChange={() => setSellerAcceptSocialShare(false)} /> No</label>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button type="button" className="btn-army-outline" onClick={() => doSellerRespond(false)} disabled={submitting}>Decline</button>
                      <button type="button" className="btn-army" onClick={() => doSellerRespond(true)} disabled={submitting || (conn.buyer_want_social_share != null && sellerAcceptSocialShare === null)}>Accept</button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">Waiting for the seller to accept or decline… You'll be notified.</p>
                )}
              </div>
            )}

            {conn.stage === "bonding" && (
              <div ref={bondingSectionRef} className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">Answer 3 BTS bonding questions. If either side doesn't answer within 24 hours, the connection expires.</p>
                {((isBuyer && conn.buyer_bonding_submitted_at) || (isSeller && conn.seller_bonding_submitted_at)) ? (
                  <p className="mt-4 text-sm font-semibold text-army-purple">Thanks — you've submitted your answers. Waiting for the other ARMY… You'll be notified.</p>
                ) : (
                  <>
                    <div className="mt-5 space-y-4">
                      {bondingQuestions.map((q, idx) => (
                        <div key={q.id}>
                          <label className="block text-sm font-semibold text-army-purple">{idx + 1}. {q.prompt}</label>
                          <textarea rows={3} className="input-army mt-2 resize-none" value={answers[q.id] ?? ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))} placeholder="Type your answer…" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button type="button" className="btn-army" onClick={doSubmitBonding} disabled={!canSubmitBonding}>{submitting ? "Submitting…" : "Submit answers"}</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {conn.stage === "buyer_bonding_v2" && (
              <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
                {isBuyer ? (
                  <>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">The seller accepted. Answer these 2 questions to build trust (saved once for all your connections).</p>
                    {conn.buyer_bonding_submitted_at ? (
                      <p className="mt-4 text-sm font-semibold text-army-purple">Thanks — you've submitted. Loading…</p>
                    ) : (
                      <>
                        <div className="mt-5 space-y-4">
                          {bondingQuestions.map((q, idx) => (
                            <div key={q.id}>
                              <label className="block text-sm font-semibold text-army-purple">{idx + 1}. {q.prompt}</label>
                              <textarea rows={3} className="input-army mt-2 resize-none w-full" value={answers[q.id] ?? ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))} placeholder="Type your answer…" />
                            </div>
                          ))}
                        </div>
                        <div className="mt-6 flex justify-end">
                          <button type="button" className="btn-army" onClick={doSubmitBonding} disabled={!canSubmitBonding}>{submitting ? "Submitting…" : "Submit answers"}</button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">Waiting for the buyer to answer 2 bonding questions…</p>
                )}
              </div>
            )}

            {conn.stage === "preview" && (
              <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">Preview each other's info first. Then answer: "Are you comfortable speaking with this ARMY?"</p>
                {!preview ? (
                  <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">Loading preview…</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-army-purple/10 bg-army-purple/5 p-4 text-sm text-neutral-800 dark:border-army-purple/20 dark:bg-army-purple/10 dark:text-neutral-200">
                      <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Listing</p>
                      <p className="mt-1 font-semibold text-army-purple">{String((preview as any)?.listing?.title ?? "—")}</p>
                      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                        Qty {Number((preview as any)?.listing?.quantity ?? 0)} · {formatPrice(Number((preview as any)?.listing?.price ?? 0), String((preview as any)?.listing?.currency ?? "USD"))}
                      </p>
                      {(preview as any)?.listing?.description && (
                        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{String((preview as any).listing.description)}</p>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(["buyer", "seller"] as const).map((role) => {
                        const p = (preview as any)?.[role] ?? null;
                        const title = role === "buyer" ? (isBuyer ? "You (Buyer)" : "Buyer") : (isSeller ? "You (Seller)" : "Seller");
                        const answersObj = (role === "buyer" ? (preview as any)?.buyer?.bondingAnswers : (preview as any)?.seller?.bondingAnswers) ?? {};
                        const answerMap = typeof answersObj === "object" && answersObj ? (answersObj as Record<string, unknown>) : {};
                        return (
                          <div key={role} className="rounded-xl border border-army-purple/15 bg-white p-4 dark:border-army-purple/25 dark:bg-neutral-900">
                            <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">{title}</p>
                            <p className="mt-2 text-sm text-neutral-800 dark:text-neutral-200"><span className="font-semibold">First name:</span> {String(p?.firstName ?? "—")}</p>
                            <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200"><span className="font-semibold">Country:</span> {String(p?.country ?? "—")}</p>
                            <div className="mt-3 space-y-2 text-sm text-neutral-800 dark:text-neutral-200">
                              <p className="font-semibold text-army-purple">ARMY profile</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-semibold">{String((p as any)?.armyBiasPrompt ?? "Bias")}:</span> {String(p?.armyBiasAnswer ?? "—")}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-semibold">{String((p as any)?.armyYearsArmyPrompt ?? "Years ARMY")}:</span> {String(p?.armyYearsArmy ?? "—")}</p>
                              <p className="whitespace-pre-wrap break-words"><span className="font-semibold">{String((p as any)?.armyFavoriteAlbumPrompt ?? "Favorite album")}:</span> {String(p?.armyFavoriteAlbum ?? "—")}</p>
                            </div>
                            <div className="mt-4 rounded-lg border border-army-purple/10 bg-army-purple/5 p-3 dark:border-army-purple/20 dark:bg-army-purple/10">
                              <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Bonding answers</p>
                              {bondingQuestions.length >= 2 ? (
                                <div className="mt-2 space-y-3">
                                  {bondingQuestions.map((q, idx) => (
                                    <div key={q.id}>
                                      <p className="text-sm font-semibold text-army-purple">{idx + 1}. {q.prompt}</p>
                                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">{String(answerMap[q.id] ?? "—")}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">Bonding answers not available.</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p className="mt-5 text-sm font-semibold text-army-purple">Are you comfortable speaking with this ARMY?</p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" className="btn-army-outline" onClick={() => doComfort(false)} disabled={submitting || myComfort !== null}>No</button>
                  <button type="button" className="btn-army" onClick={() => doComfort(true)} disabled={submitting || myComfort !== null}>Yes</button>
                </div>
              </div>
            )}

            {conn.stage === "social" && (
              <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">Share your connected social media with this ARMY? Socials are shared only if BOTH say Yes.</p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" className="btn-army-outline" onClick={() => doSocial(false)} disabled={submitting || mySocialShare !== null}>No</button>
                  <button type="button" className="btn-army" onClick={() => doSocial(true)} disabled={submitting || mySocialShare !== null}>Yes</button>
                </div>
              </div>
            )}

            {conn.stage === "agreement" && (
              <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">You have a match. Both buyer and seller must read the message and confirm to continue.</p>
                <div className="mt-5 flex justify-end">
                  <button type="button" className="btn-army" onClick={() => setMatchOpen(true)} disabled={submitting}>Open match message</button>
                </div>
              </div>
            )}

            {(conn.stage === "chat_open" || conn.stage === "ended") && (
              <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">Connection complete. If both agreed to share socials, you can connect there (no in-app chat).</p>
                {isBuyer && (
                  <div className="mt-4 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 dark:border-army-purple/25 dark:bg-army-purple/10">
                    <p className="text-sm font-semibold text-army-purple">Optional: rate the seller</p>
                    {sellerRating != null ? (
                      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">Thanks — you rated this seller {sellerRating}/5.</p>
                    ) : (
                      <div className="mt-2">
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className="h-9 w-9 rounded-lg border border-army-purple/30 bg-white text-sm font-semibold text-army-purple hover:bg-army-purple/10 dark:border-army-purple/40 dark:bg-neutral-900 dark:hover:bg-army-purple/20"
                              onClick={async () => {
                                setRatingError(null);
                                setRatingSubmitting(true);
                                const { error: err } = await supabase.rpc("submit_merch_connection_rating", {
                                  p_connection_id: connectionId,
                                  p_rating: n,
                                });
                                setRatingSubmitting(false);
                                if (err) setRatingError(err.message);
                                else setSellerRating(n);
                              }}
                              disabled={ratingSubmitting}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        {ratingError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{ratingError}</p>}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <Link href="/tickets?mode=merch" className="btn-army">Back to Listings</Link>
                </div>
              </div>
            )}
          </>
        )}

        <UserReportModal open={reportOpen} onClose={() => setReportOpen(false)} reportedUserId={otherUserId} reportedLabel={otherLabel} onReported={() => setNotice("Thanks — your report has been submitted.")} />

        {matchOpen && conn && (
          <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="match-modal-title" onClick={() => setMatchOpen(false)}>
            <div className="w-full max-w-2xl cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="match-modal-title" className="font-display text-xl font-bold text-army-purple">You Have a Match</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Please read carefully.</p>
                </div>
                <button type="button" className="btn-army-outline" onClick={() => setMatchOpen(false)} disabled={submitting}>Close</button>
              </div>
              <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-xl border border-army-purple/15 bg-white/80 p-4 text-sm text-neutral-800 dark:border-army-purple/25 dark:bg-neutral-900/60 dark:text-neutral-200">
                {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
                {!myAgreed ? (
                  <>
                    <p className="font-semibold text-army-purple">💜 Before You Continue</p>
                    <p className="mt-2">You are about to connect with an {otherRoleLabel} outside this platform. Please read carefully. This platform is only here to help ARMYs connect. We do not verify merch, identities, or payments. Once you move to social media or private communication, you do so at your own discretion.</p>
                    <hr className="my-4 border-army-purple/15 dark:border-army-purple/25" />
                    <p className="font-semibold text-army-purple">Take your time</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5"><li>Get comfortable as ARMY first</li><li>Talk about BTS, your experiences</li><li>A real connection should not feel rushed</li></ul>
                    <hr className="my-4 border-army-purple/15 dark:border-army-purple/25" />
                    <p className="font-semibold text-army-purple">Never feel pressured</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5"><li>Anyone pushing you to "act fast" is a red flag</li><li>You can walk away at any time</li></ul>
                    <hr className="my-4 border-army-purple/15 dark:border-army-purple/25" />
                    <p className="font-semibold text-army-purple">By continuing, you confirm:</p>
                    <div className="mt-2 space-y-2">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" className="mt-1 h-4 w-4" checked={matchAck1} onChange={(e) => setMatchAck1(e.target.checked)} />
                        <span>I understand the admins do not verify merch, handle payments, or take responsibility for transactions</span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" className="mt-1 h-4 w-4" checked={matchAck2} onChange={(e) => setMatchAck2(e.target.checked)} />
                        <span>I choose to continue this connection at my own discretion</span>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-army-purple">💜 You're Connected</p>
                    <p className="mt-2">{bothChoseShareSocials ? "Here is your match's social media:" : "You both chose not to share socials."}</p>
                    {bothChoseShareSocials && socials?.show ? (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-xl border border-army-purple/15 bg-white p-3 dark:border-army-purple/25 dark:bg-neutral-900">
                          <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Buyer</p>
                          <p className="mt-1">Instagram: {socials.buyer.instagram ?? "—"}</p>
                          <p>Facebook: {socials.buyer.facebook ?? "—"}</p>
                        </div>
                        <div className="rounded-xl border border-army-purple/15 bg-white p-3 dark:border-army-purple/25 dark:bg-neutral-900">
                          <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Seller</p>
                          <p className="mt-1">Instagram: {socials.seller.instagram ?? "—"}</p>
                          <p>Facebook: {socials.seller.facebook ?? "—"}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Socials will appear here once both users choose to share socials.</p>
                    )}
                    <p className="mt-3">Wishing you a meaningful ARMY connection 💜</p>
                  </>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {!myAgreed ? (
                  <div className="flex flex-col items-end gap-2">
                    {(conn.stage !== "agreement" || !matchAck1 || !matchAck2) && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {conn.stage !== "agreement" ? "You can confirm once the connection is in the Agreement step." : !matchAck1 || !matchAck2 ? "Please check both boxes to confirm." : null}
                      </p>
                    )}
                    <button type="button" className="btn-army disabled:cursor-not-allowed disabled:opacity-60" onClick={doAgreement} disabled={submitting || conn.stage !== "agreement" || !matchAck1 || !matchAck2}>
                      {submitting ? "Confirming…" : "CONFIRM"}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn-army" onClick={() => setMatchOpen(false)}>Done</button>
                )}
              </div>
            </div>
          </div>
        )}

        {statusPopup && !statusPopupClosed && (
          <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="status-popup-title" onClick={() => setStatusPopupClosed(true)}>
            <div className="w-full max-w-lg cursor-default rounded-2xl border border-army-purple/25 bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="status-popup-title" className="font-display text-xl font-bold text-army-purple">💜 Saved</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{meRoleLabel} update</p>
                </div>
                <button type="button" className="btn-army-outline" onClick={() => setStatusPopupClosed(true)}>Close</button>
              </div>
              <div className="mt-4 rounded-xl border border-army-purple/15 bg-army-purple/5 px-4 py-3 text-sm text-neutral-800 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-200">{statusPopup}</div>
              <div className="mt-6 flex justify-end">
                <button type="button" className="btn-army" onClick={() => setStatusPopupClosed(true)}>Got it</button>
              </div>
            </div>
          </div>
        )}

        {bondingIntroOpen && conn?.stage === "bonding" && isSeller && (
          <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="bonding-intro-title" onClick={() => { try { window.localStorage.setItem(`army_merch_bonding_intro_seen:${connectionId}`, "1"); } catch { /* ignore */ } setBondingIntroOpen(false); }}>
            <div className="w-full max-w-lg cursor-default rounded-2xl border border-army-purple/25 bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="bonding-intro-title" className="font-display text-xl font-bold text-army-purple">💜 Accepted</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Now let's build trust with the buyer.</p>
                </div>
                <button type="button" className="btn-army-outline" onClick={() => { try { window.localStorage.setItem(`army_merch_bonding_intro_seen:${connectionId}`, "1"); } catch { /* ignore */ } setBondingIntroOpen(false); }}>Close</button>
              </div>
              <div className="mt-4 space-y-3 rounded-xl border border-army-purple/15 bg-army-purple/5 px-4 py-3 text-sm text-neutral-800 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-200">
                <p>You accepted this request. Next step is <span className="font-semibold text-army-purple">Bonding</span>.</p>
                <p>Answer <span className="font-semibold">3 bonding questions</span> to help the buyer feel safe and confirm you're real ARMY.</p>
              </div>
              <div className="mt-6 flex justify-end">
                <button type="button" className="btn-army" onClick={() => { try { window.localStorage.setItem(`army_merch_bonding_intro_seen:${connectionId}`, "1"); } catch { /* ignore */ } setBondingIntroOpen(false); setTimeout(() => bondingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>Show bonding questions</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
