"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import EditListingModal from "@/components/EditListingModal";
import RequireAuth from "@/components/RequireAuth";
import ConnectionTicketDetailsModal from "@/components/ConnectionTicketDetailsModal";
import ListingReportModal from "@/components/ListingReportModal";
import PostListingModal from "@/components/PostListingModal";
import { ARIRANG_CONTINENTS, getContinentForCity } from "@/lib/data/arirang";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";
import {
  connectToListingV2,
  endConnection,
  undoEndConnection,
  fetchBrowseListingSellerDetails,
  fetchBrowseListings,
  fetchListingSellerProfileForConnect,
  fetchMyListings,
  getConnectionBondingQuestionIds,
  hasUserBondingAnswers,
  upsertUserBondingAnswers,
  type BrowseListingCard,
  type BrowseListingSellerDetails,
  type ListingSellerProfileForConnect,
  type MyListing,
} from "@/lib/supabase/listings";
import { supabase } from "@/lib/supabaseClient";

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function browseStatusPill(status: string): { label: string; cls: string } {
  const s = String(status || "").toLowerCase();
  if (s === "sold") {
    return { label: "Sold", cls: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100" };
  }
  if (s === "locked") {
    return { label: "Locked", cls: "bg-amber-500/15 text-amber-900 dark:text-amber-200" };
  }
  // Note: "All Listings" only shows listings where processing_until has passed,
  // but some rows may still have status="processing" in DB (we don't auto-flip it).
  // Treat those as Active in the browse UI to avoid confusion.
  return { label: "Active", cls: "bg-army-200/60 text-army-900 dark:bg-army-300/25 dark:text-army-200" };
}

function listingStatusLabel(l: MyListing): { label: string; color: string } {
  if (l.status === "removed") return { label: "Removed", color: "bg-red-500/15 text-red-700 dark:text-red-300" };
  if (l.status === "sold") return { label: "Sold", color: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200" };
  if (l.status === "locked") return { label: "Locked", color: "bg-amber-500/15 text-amber-800 dark:text-amber-200" };
  if (l.processingUntil && new Date(l.processingUntil).getTime() > Date.now()) {
    return { label: "Processing", color: "bg-army-purple/10 text-army-purple" };
  }
  return { label: "Active", color: "bg-army-200/50 text-army-800 dark:bg-army-300/30 dark:text-army-200" };
}

export default function ConnectionBoardView() {
  const { user, isAdmin } = useAuth();
  const { notifications, markRead } = useNotifications();
  const [tab, setTab] = useState<"my" | "all" | "connections">("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [browse, setBrowse] = useState<BrowseListingCard[]>([]);
  const [mine, setMine] = useState<MyListing[]>([]);
  const [connections, setConnections] = useState<
    Array<{ id: string; stage: string; stageExpiresAt: string; listingId: string; buyerId: string; sellerId: string }>
  >([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterCity, setFilterCity] = useState("");
  const [filterContinent, setFilterContinent] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPriceMin, setFilterPriceMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "locked" | "sold">("");
  const [filterVip, setFilterVip] = useState<"" | "vip" | "standard" | "loge" | "suite">("");
  const [filterQuantity, setFilterQuantity] = useState<"" | "1" | "2" | "3" | "4">("");

  const [postOpen, setPostOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectConfirm, setConnectConfirm] = useState<{ listingId: string; summary: string } | null>(null);
  const [connectV2, setConnectV2] = useState<{ listingId: string; summary: string } | null>(null);
  const [connectV2SellerProfile, setConnectV2SellerProfile] = useState<{
    data: ListingSellerProfileForConnect | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: false, error: null });
  const [connectV2SocialShare, setConnectV2SocialShare] = useState<boolean | null>(null);
  const [connectV2BondingAnswers, setConnectV2BondingAnswers] = useState<Record<string, string>>({});
  const [connectV2HasBonding, setConnectV2HasBonding] = useState<boolean | null>(null);
  const [connectV2QuestionIds, setConnectV2QuestionIds] = useState<string[]>([]);
  const [connectV2Prompts, setConnectV2Prompts] = useState<Array<{ id: string; prompt: string }>>([]);
  const [showMigrationBondingModal, setShowMigrationBondingModal] = useState(false);
  const [migrationBondingAnswers, setMigrationBondingAnswers] = useState<Record<string, string>>({});
  const [migrationBondingPrompts, setMigrationBondingPrompts] = useState<Array<{ id: string; prompt: string }>>([]);
  const [migrationBondingQuestionIds, setMigrationBondingQuestionIds] = useState<string[]>([]);
  const [migrationBondingSubmitting, setMigrationBondingSubmitting] = useState(false);
  const [limitOpen, setLimitOpen] = useState<{ title: string; body: string } | null>(null);
  const [ticketDetailsOpen, setTicketDetailsOpen] = useState<{ connectionId: string } | null>(null);
  const [listingDetailsOpen, setListingDetailsOpen] = useState<{ listingId: string; summary: string } | null>(null);
  const [listingDetailsFetch, setListingDetailsFetch] = useState<{
    loading: boolean;
    data: BrowseListingSellerDetails | null;
    error: string | null;
  } | null>(null);
  const [lockedExplain, setLockedExplain] = useState<{ summary: string; lockExpiresAt: string | null } | null>(null);
  const [reportOpen, setReportOpen] = useState<{ listingId: string; summary: string } | null>(null);
  const [editing, setEditing] = useState<MyListing | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [justEndedConnectionId, setJustEndedConnectionId] = useState<string | null>(null);
  const undoEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [needsSocialMigration, setNeedsSocialMigration] = useState(false);
  const [socialMigrationBannerDismissed, setSocialMigrationBannerDismissed] = useState(false);

  useEffect(() => {
    if (!listingDetailsOpen) {
      setListingDetailsFetch(null);
      return;
    }
    setListingDetailsFetch({ loading: true, data: null, error: null });
    void fetchBrowseListingSellerDetails(listingDetailsOpen.listingId).then((res) => {
      setListingDetailsFetch({
        loading: false,
        data: res.data ?? null,
        error: res.error ?? null,
      });
    });
  }, [listingDetailsOpen?.listingId]);

  useEffect(() => {
    if (!connectV2 || !user) {
      setConnectV2HasBonding(null);
      setConnectV2QuestionIds([]);
      setConnectV2Prompts([]);
      setConnectV2SellerProfile({ data: null, loading: false, error: null });
      return;
    }
    setConnectV2SocialShare(null);
    setConnectV2BondingAnswers({});
    setConnectV2SellerProfile({ data: null, loading: true, error: null });
    let cancelled = false;
    void fetchListingSellerProfileForConnect(connectV2.listingId).then((res) => {
      if (!cancelled)
        setConnectV2SellerProfile({
          data: res.data ?? null,
          loading: false,
          error: res.error ?? null,
        });
    });
    return () => {
      cancelled = true;
    };
  }, [connectV2?.listingId]);

  useEffect(() => {
    if (!connectV2 || !user) {
      setConnectV2HasBonding(null);
      setConnectV2QuestionIds([]);
      setConnectV2Prompts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [hasBonding, qIdsRes] = await Promise.all([
        hasUserBondingAnswers(user.id),
        getConnectionBondingQuestionIds(),
      ]);
      if (cancelled) return;
      setConnectV2HasBonding(hasBonding);
      const ids = qIdsRes.data ?? [];
      setConnectV2QuestionIds(ids);
      if (!hasBonding && ids.length >= 2) {
        const { data: rows } = await supabase.from("bonding_questions").select("id, prompt").in("id", ids);
        if (!cancelled && Array.isArray(rows))
          setConnectV2Prompts(
            ids.map((id) => ({ id, prompt: String((rows as any[]).find((r) => r.id === id)?.prompt ?? "Question") }))
          );
      } else {
        setConnectV2Prompts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectV2?.listingId, user?.id]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const [b, m, c, profileRes] = await Promise.all([
      fetchBrowseListings(),
      fetchMyListings(user.id),
      supabase
        .from("connections")
        .select("id, stage, stage_expires_at, listing_id, buyer_id, seller_id, ended_by, ended_at")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("instagram, facebook, tiktok, snapchat").eq("id", user.id).single(),
    ]);
    const profile = (profileRes as any)?.data;
    const hasInsta = (profile?.instagram ?? "").toString().trim().length > 0;
    const hasFb = (profile?.facebook ?? "").toString().trim().length > 0;
    const hasTikTok = (profile?.tiktok ?? "").toString().trim().length > 0;
    const hasSnap = (profile?.snapchat ?? "").toString().trim().length > 0;
    setNeedsSocialMigration((hasTikTok || hasSnap) && !hasInsta && !hasFb);
    if (b.error) setError(b.error);
    if (m.error) setError(m.error);
    // Keep ordering "Active first", then "Locked", then "Sold" to reduce confusion.
    // Preserve the relative order within each group (so if a listing is released, it returns to its original place).
    const activeLike = b.data.filter((x) => String(x.status) !== "locked" && String(x.status) !== "sold");
    const locked = b.data.filter((x) => String(x.status) === "locked");
    const sold = b.data.filter((x) => String(x.status) === "sold");
    setBrowse([...activeLike, ...locked, ...sold]);
    setMine(m.data);
    if ((c as any).error) setError(String((c as any).error.message ?? "Failed to load connections"));
    else {
      const rows = (((c as any).data ?? []) as any[]).map((r) => ({
        id: String(r.id),
        stage: String(r.stage ?? ""),
        stageExpiresAt: String(r.stage_expires_at ?? ""),
        listingId: String(r.listing_id ?? ""),
        buyerId: String(r.buyer_id ?? ""),
        sellerId: String(r.seller_id ?? ""),
        endedBy: r.ended_by ? String(r.ended_by) : null,
        endedAt: r.ended_at ? String(r.ended_at) : null,
      }));
      // Keep active/in-progress connections at the top, and push ended/expired/declined to the bottom.
      // Preserve relative order within each group.
      const finished = new Set(["ended", "expired", "declined"]);
      const activeLike = rows.filter((x) => !finished.has(String(x.stage)));
      const endedLike = rows.filter((x) => finished.has(String(x.stage)));
      setConnections([...activeLike, ...endedLike]);

      // Migration: sellers with existing listings (no connection yet) and no bonding answers — show modal once
      if (m.data.length > 0) {
        const allConns = [...activeLike, ...endedLike];
        const listingIdsWithConnections = new Set(allConns.filter((c) => c.sellerId === user.id).map((c) => c.listingId));
        const listingsNoConnection = m.data.filter(
          (l) => l.status !== "removed" && l.status !== "sold" && !listingIdsWithConnections.has(l.id)
        );
        if (listingsNoConnection.length > 0) {
          const hasBonding = await hasUserBondingAnswers(user.id);
          if (
            !hasBonding &&
            typeof window !== "undefined" &&
            !localStorage.getItem("army_seller_bonding_migration_done:" + user.id)
          ) {
            setShowMigrationBondingModal(true);
            const { data: ids } = await getConnectionBondingQuestionIds();
            const idList = ids ?? [];
            setMigrationBondingQuestionIds(idList);
            if (idList.length >= 2) {
              const { data: rowsQ } = await supabase.from("bonding_questions").select("id, prompt").in("id", idList);
              setMigrationBondingPrompts(
                idList.map((id) => ({ id, prompt: String((rowsQ as any[]).find((r: any) => r.id === id)?.prompt ?? "Question") }))
              );
            }
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const myActiveListing = useMemo(() => {
    return mine.find((l) => l.status === "processing" || l.status === "active" || l.status === "locked") ?? null;
  }, [mine]);

  const activeListingsCount = useMemo(() => {
    return mine.filter((l) => ["processing", "active", "locked"].includes(l.status)).length;
  }, [mine]);

  // My Listings tab: show only non-removed so removed (often 0-seat) listings don’t clutter the list.
  const mineDisplay = useMemo(() => mine.filter((l) => l.status !== "removed"), [mine]);

  const sellerHasActiveAcceptedConnectionByListingId = useMemo(() => {
    if (!user) return new Map<string, boolean>();
    const map = new Map<string, boolean>();
    for (const c of connections) {
      if (c.sellerId !== user.id) continue;
      // "Accepted / active" = not pending_seller; these stages mean the seller accepted a request.
      if (!["bonding", "preview", "comfort", "social", "agreement", "chat_open"].includes(String(c.stage))) continue;
      map.set(String(c.listingId), true);
    }
    return map;
  }, [connections, user]);

  const browseCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const l of browse) {
      for (const seat of l.seats ?? []) {
        const c = String(seat.currency ?? "").trim();
        if (c) set.add(c);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [browse]);

  const browseCities = useMemo(() => {
    const set = new Set<string>();
    for (const l of browse) {
      const c = String(l.concertCity ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [browse]);

  const unreadConnectionNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.read && !!n.connectionId).length;
  }, [notifications]);

  const unreadConnectionIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of notifications) {
      if (!n.read && n.connectionId) set.add(n.connectionId);
    }
    return set;
  }, [notifications]);

  const unreadConnectionCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notifications) {
      if (n.read) continue;
      if (!n.connectionId) continue;
      map.set(n.connectionId, (map.get(n.connectionId) ?? 0) + 1);
    }
    return map;
  }, [notifications]);

  const filteredBrowse = useMemo(() => {
    const city = filterCity.trim();
    const continent = filterContinent.trim();
    const min = filterPriceMin.trim() ? Number(filterPriceMin) : null;
    const max = filterPriceMax.trim() ? Number(filterPriceMax) : null;
    const from = filterDateFrom.trim();
    const to = filterDateTo.trim();
    const currency = filterCurrency.trim();
    const status = filterStatus;
    const vipFilter = filterVip;
    const qty = filterQuantity ? Number(filterQuantity) : null;

    return browse.filter((l) => {
      if (status && String(l.status) !== status) return false;
      if (vipFilter === "vip" && (!l.vip || l.loge)) return false;
      if (vipFilter === "standard" && (l.vip || l.loge)) return false;
      if (vipFilter === "loge" && !l.loge) return false;
      if (qty != null && Number.isFinite(qty) && (l.quantity ?? 1) !== qty) return false;
      if (city && String(l.concertCity ?? "") !== city) return false;
      if (continent && getContinentForCity(String(l.concertCity ?? "")) !== continent) return false;
      const seatCurrencies = (l.seats ?? []).map((s) => String(s.currency ?? "").trim());
      if (currency && (seatCurrencies.length === 0 || !seatCurrencies.includes(currency))) return false;

      const d = String(l.concertDate ?? "");
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;

      const seatPrices = (l.seats ?? []).map((s) => Number(s.faceValuePrice ?? 0));
      const price = seatPrices.length > 0 ? Math.min(...seatPrices) : 0;
      if (min != null && Number.isFinite(min) && price < min) return false;
      if (max != null && Number.isFinite(max) && price > max) return false;
      return true;
    });
  }, [browse, filterCity, filterContinent, filterCurrency, filterDateFrom, filterDateTo, filterPriceMax, filterPriceMin, filterQuantity, filterStatus, filterVip]);

  const migrationBondingSubmit = async () => {
    if (migrationBondingQuestionIds.length < 2) return;
    const a = migrationBondingAnswers;
    if (!migrationBondingQuestionIds.every((id) => (a[id] ?? "").trim())) {
      setError("Please answer both questions.");
      return;
    }
    if (!user) return;
    setMigrationBondingSubmitting(true);
    setError(null);
    const answers = Object.fromEntries(migrationBondingQuestionIds.map((id) => [id, (a[id] ?? "").trim()]));
    const { error: e } = await upsertUserBondingAnswers(migrationBondingQuestionIds, answers);
    setMigrationBondingSubmitting(false);
    if (e) setError(e);
    else {
      if (typeof window !== "undefined") localStorage.setItem("army_seller_bonding_migration_done:" + user.id, "1");
      setShowMigrationBondingModal(false);
      setMigrationBondingAnswers({});
    }
  };

  const connectV2Submit = async () => {
    if (!connectV2 || connectV2SocialShare === null) return;
    if (connectV2HasBonding === false && connectV2QuestionIds.length >= 2) {
      const a = connectV2BondingAnswers;
      if (!connectV2QuestionIds.every((id) => (a[id] ?? "").trim())) {
        setError("Please answer both bonding questions.");
        return;
      }
    }
    setConnectingId(connectV2.listingId);
    setError(null);
    const bonding =
      connectV2HasBonding === false && connectV2QuestionIds.length >= 2
        ? Object.fromEntries(connectV2QuestionIds.map((id) => [id, (connectV2BondingAnswers[id] ?? "").trim()]))
        : undefined;
    const questionIds =
      connectV2HasBonding === false && connectV2QuestionIds.length >= 2 ? connectV2QuestionIds : undefined;
    const { connectionId, error: e } = await connectToListingV2(
      connectV2.listingId,
      connectV2SocialShare,
      bonding,
      questionIds
    );
    setConnectingId(null);
    if (e) {
      if (e.toLowerCase().includes("3 active") || e.toLowerCase().includes("maximum")) {
        setLimitOpen({
          title: "Connection limit reached",
          body: "You can only have up to 3 active connection requests at a time. Please end or finish one of your existing connections, then try again.",
        });
      } else {
        setError(e);
      }
      setConnectV2(null);
      return;
    }
    setConnectV2(null);
    if (connectionId) {
      window.location.href = `/connections/${encodeURIComponent(connectionId)}`;
    }
  };

  const cancelRequest = async (connectionId: string) => {
    if (!confirm("End this connection? The listing will be unlocked and the other person will be notified.")) return;
    setMutatingId(connectionId);
    setError(null);
    try {
      const { error: e } = await endConnection(connectionId);
      if (e) {
        setError(e);
      } else {
        if (undoEndTimeoutRef.current) clearTimeout(undoEndTimeoutRef.current);
        setJustEndedConnectionId(connectionId);
        undoEndTimeoutRef.current = setTimeout(() => {
          setJustEndedConnectionId(null);
          undoEndTimeoutRef.current = null;
        }, 30_000);
      }
      await load();
    } finally {
      setMutatingId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (undoEndTimeoutRef.current) clearTimeout(undoEndTimeoutRef.current);
    };
  }, []);

  const handleUndoEndConnection = async (connectionId?: string) => {
    const id = connectionId ?? justEndedConnectionId;
    if (!id) return;
    setJustEndedConnectionId(null);
    if (undoEndTimeoutRef.current) {
      clearTimeout(undoEndTimeoutRef.current);
      undoEndTimeoutRef.current = null;
    }
    setError(null);
    const { error: e } = await undoEndConnection(id);
    if (e) setError(e);
    await load();
  };

  const activeConnectionStages = useMemo(() => {
    return new Set(["pending_seller", "bonding", "buyer_bonding_v2", "preview", "comfort", "social", "agreement", "chat_open"]);
  }, []);

  const myActiveBuyerConnectionByListingId = useMemo(() => {
    if (!user) return new Map<string, { id: string; stage: string }>();
    const map = new Map<string, { id: string; stage: string }>();
    for (const c of connections) {
      if (c.buyerId !== user.id) continue;
      if (!activeConnectionStages.has(String(c.stage))) continue;
      // Most recent wins (connections are ordered desc).
      if (!map.has(c.listingId)) map.set(c.listingId, { id: c.id, stage: c.stage });
    }
    return map;
  }, [activeConnectionStages, connections, user]);

  const myActiveSellerConnectionByListingId = useMemo(() => {
    if (!user) return new Map<string, { id: string; stage: string }>();
    const map = new Map<string, { id: string; stage: string }>();
    for (const c of connections) {
      if (c.sellerId !== user.id) continue;
      if (!activeConnectionStages.has(String(c.stage))) continue;
      if (!map.has(c.listingId)) map.set(c.listingId, { id: c.id, stage: c.stage });
    }
    return map;
  }, [activeConnectionStages, connections, user]);

  const markSold = async (listingId: string) => {
    setMutatingId(listingId);
    setError(null);
    try {
      const res = await fetch("/api/listings/mark-sold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) setError(j?.error || `HTTP ${res.status}`);
      await load();
    } finally {
      setMutatingId(null);
    }
  };

  const markNotSold = async (listingId: string) => {
    setMutatingId(listingId);
    setError(null);
    try {
      const res = await fetch("/api/listings/mark-not-sold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) setError(j?.error || `HTTP ${res.status}`);
      await load();
    } finally {
      setMutatingId(null);
    }
  };

  const deleteListing = async (listingId: string) => {
    if (!confirm("Delete this listing? This will remove it from All Listings.")) return;
    setMutatingId(listingId);
    setError(null);
    try {
      const res = await fetch("/api/listings/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) setError(j?.error || `HTTP ${res.status}`);
      await load();
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <RequireAuth>
      <div className="mx-auto max-w-7xl">
        {needsSocialMigration && !socialMigrationBannerDismissed && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-950/30">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              We now support only <strong>Instagram</strong> and <strong>Facebook</strong> for contact. You currently have only TikTok or Snapchat. Please add Instagram or Facebook in{" "}
              <Link href="/settings" className="font-semibold underline hover:no-underline">Settings</Link> so buyers can reach you.
            </p>
            <div className="mt-2 flex items-center justify-between">
              <Link href="/settings" className="btn-army text-sm">Go to Settings</Link>
              <button type="button" className="text-xs text-amber-700 dark:text-amber-300 hover:underline" onClick={() => setSocialMigrationBannerDismissed(true)}>
                Dismiss for now
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold text-army-purple sm:text-4xl">
              ARMY Connection Board
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
              Connect with ARMYs through tickets at face value. This is <span className="font-semibold">not</span> a marketplace.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAdmin && (
              <Link href="/admin" className="btn-army-outline">
                Admin
              </Link>
            )}
            <button
              type="button"
              className="btn-army disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                if (activeListingsCount >= 3) {
                  setLimitOpen({
                    title: "Listing limit reached",
                    body: "You can have a maximum of 3 active listings at a time (sold and removed do not count). Mark one sold, delete it, or wait until it is no longer active.",
                  });
                  return;
                }
                setPostOpen(true);
              }}
              disabled={activeListingsCount >= 3}
              title={activeListingsCount >= 3 ? "Max 3 active listings" : "Post a listing"}
            >
              Post Listing
            </button>
          </div>
        </div>

        <div className="mt-6 inline-flex w-full max-w-xl rounded-2xl border border-army-purple/15 bg-white p-1 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          <button
            type="button"
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === "all" ? "bg-army-purple text-white" : "text-army-purple hover:bg-army-purple/10"
            }`}
            onClick={() => setTab("all")}
          >
            All Listings
          </button>
          <button
            type="button"
            className={`relative flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === "connections" ? "bg-army-purple text-white" : "text-army-purple hover:bg-army-purple/10"
            }`}
            onClick={() => setTab("connections")}
          >
            My Connections
            {unreadConnectionNotificationCount > 0 && (
              <span
                className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  tab === "connections" ? "bg-white text-army-purple" : "bg-army-purple text-white"
                }`}
                aria-label={`${unreadConnectionNotificationCount} unread connection updates`}
              >
                {unreadConnectionNotificationCount > 99 ? "99+" : unreadConnectionNotificationCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === "my" ? "bg-army-purple text-white" : "text-army-purple hover:bg-army-purple/10"
            }`}
            onClick={() => setTab("my")}
          >
            My Listings
          </button>
        </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {justEndedConnectionId && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-army-purple/20 bg-army-purple/10 px-4 py-3 text-sm text-army-purple dark:bg-army-purple/20 dark:text-army-200">
          <span>Connection ended. The other person has been notified.</span>
          <button
            type="button"
            className="font-semibold underline hover:no-underline"
            onClick={() => handleUndoEndConnection()}
          >
            Undo
          </button>
        </div>
      )}

      {activeListingsCount >= 3 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          You can have a maximum of <span className="font-semibold">3 active listings</span> at a time (sold and removed do not count).
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-center text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : tab === "connections" ? (
          connections.length === 0 ? (
            <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-10 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
              No connections yet.
            </p>
          ) : (
            <div className="space-y-3">
              {connections.map((c) => {
                const stage = String(c.stage);
                const isFinished = stage === "ended" || stage === "expired" || stage === "declined";
                const endedAt = c.endedAt ? new Date(c.endedAt) : null;
                const canUndoFromList =
                  stage === "ended" &&
                  !!user &&
                  c.endedBy === user.id &&
                  !!endedAt &&
                  endedAt.getTime() > Date.now() - 60 * 60 * 1000;
                const cardBase =
                  "rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
                const cardTone = isFinished
                  ? "border-army-purple/10 bg-neutral-50 dark:border-army-purple/20 dark:bg-neutral-900/70"
                  : "border-army-purple/20 bg-army-purple/5 dark:border-army-purple/30 dark:bg-army-purple/15";
                return (
                <div
                  key={c.id}
                  className={`${cardBase} ${cardTone}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Stage</p>
                      <p className="mt-1 font-display text-lg font-bold text-army-purple">
                        {(() => {
                          const s = String(c.stage);
                          if (
                            s === "pending_seller" &&
                            user &&
                            c.sellerId === user.id &&
                            sellerHasActiveAcceptedConnectionByListingId.get(String(c.listingId))
                          ) {
                            return "waiting_list";
                          }
                          if (s === "chat_open") return "connected";
                          return s;
                        })()}
                      </p>
                      {c.stageExpiresAt ? (
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          Expires: {new Date(c.stageExpiresAt).toLocaleString()}
                        </p>
                      ) : null}
                      {String(c.stage) === "pending_seller" &&
                        user &&
                        c.sellerId === user.id &&
                        sellerHasActiveAcceptedConnectionByListingId.get(String(c.listingId)) && (
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          Waiting list for this listing: you can accept this after the active connection for this listing ends.
                        </p>
                      )}
                      {canUndoFromList && (
                        <p className="mt-1 text-xs text-army-purple dark:text-army-200">
                          You ended this connection less than 1 hour ago. You can restore it if this was a mistake.
                        </p>
                      )}
                    </div>
                    <div className="relative">
                      {unreadConnectionIds.has(c.id) && (
                        <span
                          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-army-purple px-1 text-[10px] font-bold text-white"
                          aria-label={`${unreadConnectionCountById.get(c.id) ?? 1} unread updates for this connection`}
                        >
                          {(unreadConnectionCountById.get(c.id) ?? 1) > 99 ? "99+" : (unreadConnectionCountById.get(c.id) ?? 1)}
                        </span>
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="btn-army-outline"
                          onClick={() => setTicketDetailsOpen({ connectionId: c.id })}
                        >
                          Ticket details
                        </button>
                        {canUndoFromList && (
                          <button
                            type="button"
                            className="btn-army-outline"
                            onClick={() => handleUndoEndConnection(c.id)}
                          >
                            Restore
                          </button>
                        )}
                        <Link
                          href={`/connections/${encodeURIComponent(c.id)}`}
                          className="btn-army"
                          onClick={() => {
                            // Mark related notifications read so the red dot clears once the user opens the connection.
                            notifications
                              .filter((n) => !n.read && n.connectionId === c.id)
                              .forEach((n) => markRead(n.id));
                          }}
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )
        ) : tab === "all" ? (
          browse.length === 0 ? (
            <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-10 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
              No listings available right now.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="btn-army-outline" onClick={() => setFiltersOpen((v) => !v)}>
                  {filtersOpen ? "Hide filters" : "Filters"}
                </button>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Showing <span className="font-semibold">{filteredBrowse.length}</span> of {browse.length}
                </p>
              </div>

              {filtersOpen && (
                <div className="mb-4 rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Continent</label>
                      <select className="input-army mt-2" value={filterContinent} onChange={(e) => setFilterContinent(e.target.value)}>
                        <option value="">All continents</option>
                        {ARIRANG_CONTINENTS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">City</label>
                      <select className="input-army mt-2" value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
                        <option value="">All cities</option>
                        {browseCities.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Date from</label>
                      <input type="date" className="input-army mt-2" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Date to</label>
                      <input type="date" className="input-army mt-2" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Min price</label>
                      <input className="input-army mt-2" value={filterPriceMin} onChange={(e) => setFilterPriceMin(e.target.value)} inputMode="decimal" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Max price</label>
                      <input className="input-army mt-2" value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)} inputMode="decimal" placeholder="500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Currency</label>
                      <select className="input-army mt-2" value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)}>
                        <option value="">All</option>
                        {browseCurrencies.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Status</label>
                      <select className="input-army mt-2" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="locked">Locked</option>
                        <option value="sold">Sold</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Type</label>
                      <select className="input-army mt-2" value={filterVip} onChange={(e) => setFilterVip(e.target.value as "" | "vip" | "standard" | "loge" | "suite")}>
                        <option value="">All</option>
                        <option value="standard">Standard only</option>
                        <option value="vip">VIP only</option>
                        <option value="loge">Loge only</option>
                        <option value="suite">Suite only</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Quantity</label>
                      <select className="input-army mt-2" value={filterQuantity} onChange={(e) => setFilterQuantity(e.target.value as "" | "1" | "2" | "3" | "4")}>
                        <option value="">All</option>
                        <option value="1">1 ticket</option>
                        <option value="2">2 tickets</option>
                        <option value="3">3 tickets</option>
                        <option value="4">4 tickets</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      className="btn-army-outline"
                      onClick={() => {
                        setFilterCity("");
                        setFilterDateFrom("");
                        setFilterDateTo("");
                        setFilterPriceMin("");
                        setFilterPriceMax("");
                        setFilterCurrency("");
                        setFilterStatus("");
                        setFilterVip("");
                        setFilterQuantity("");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              )}

              {filteredBrowse.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-10 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No listings match your filters.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredBrowse.map((l) => (
                    <div
                      key={l.listingId}
                      className="group relative rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-army-purple/25 dark:bg-neutral-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">{l.concertCity}</p>
                            {l.loge ? (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                                Loge
                              </span>
                            ) : l.suite ? (
                              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-bold text-sky-800 dark:text-sky-200">
                                Suite
                              </span>
                            ) : l.vip ? (
                              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                                VIP
                              </span>
                            ) : (
                              <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
                                Standard
                              </span>
                            )}
                            <span className="rounded-full bg-army-purple/10 px-2 py-0.5 text-xs font-medium text-army-purple dark:bg-army-purple/20 dark:text-army-300">
                              {l.quantity ?? 1} {l.quantity === 1 ? "ticket" : "tickets"}
                            </span>
                          </div>
                          <p className="mt-1 font-display text-lg font-bold text-army-purple">{l.concertDate}</p>
                        </div>
                        {(() => {
                          const pill = browseStatusPill(String(l.status));
                          const isLocked = String(l.status) === "locked";
                          const summary =
                            (l.seats?.length ?? 0) > 0
                              ? `${l.concertCity} · ${l.concertDate} · ${l.seats!.length} seat${l.seats!.length === 1 ? "" : "s"}`
                              : `${l.concertCity} · ${l.concertDate}`;
                          return (
                            <button
                              type="button"
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls} ${
                                isLocked ? "cursor-pointer hover:opacity-90" : "cursor-default"
                              }`}
                              onClick={() => {
                                if (!isLocked) return;
                                setLockedExplain({ summary, lockExpiresAt: l.lockExpiresAt });
                              }}
                              aria-label={isLocked ? "Locked listing info" : undefined}
                            >
                              {pill.label}
                            </button>
                          );
                        })()}
                      </div>
                      <div className="mt-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Seats</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {(l.seats ?? []).map((seat, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-army-purple/10 bg-army-purple/5 p-3 dark:border-army-purple/20 dark:bg-army-purple/10"
                            >
                              <p className="text-sm font-semibold text-army-purple">
                                <span className="font-semibold">Section:</span> {seat.section}
                                <span className="mx-1">·</span>
                                <span className="font-semibold">Row:</span> {seat.seatRow}
                                <span className="mx-1">·</span>
                                <span className="font-semibold">Seat:</span> {seat.seat}
                              </p>
                              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                                {formatPrice(seat.faceValuePrice, seat.currency)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          className="btn-army-outline inline-flex items-center px-2 py-1"
                          onClick={() =>
                            setListingDetailsOpen({
                              listingId: l.listingId,
                              summary:
                                (l.seats?.length ?? 0) > 0
                                  ? `${l.concertCity} · ${l.concertDate} · ${l.seats!.length} seat${l.seats!.length === 1 ? "" : "s"}`
                                  : `${l.concertCity} · ${l.concertDate}`,
                            })
                          }
                          aria-label="View more details"
                          title="View details"
                        >
                          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-army-outline disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() =>
                            setReportOpen({
                              listingId: l.listingId,
                              summary:
                                (l.seats?.length ?? 0) > 0
                                  ? `${l.concertCity} · ${l.concertDate} · ${l.seats!.length} seat${l.seats!.length === 1 ? "" : "s"}`
                                  : `${l.concertCity} · ${l.concertDate}`,
                            })
                          }
                          disabled={String(l.status) === "sold"}
                          title={String(l.status) === "sold" ? "Sold listings cannot be reported" : "Report listing"}
                        >
                          Report
                        </button>
                        {(() => {
                          const myConn = myActiveBuyerConnectionByListingId.get(l.listingId) ?? null;
                          const isSold = String(l.status) === "sold";
                          const isLocked = String(l.status) === "locked";

                          if (myConn) {
                            const isPending = String(myConn.stage) === "pending_seller";
                            return isPending ? (
                              <button
                                type="button"
                                className="btn-army disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => cancelRequest(myConn.id)}
                                disabled={mutatingId === myConn.id}
                              >
                                {mutatingId === myConn.id ? "Cancelling…" : "Cancel request"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-army disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => (window.location.href = `/connections/${encodeURIComponent(myConn.id)}`)}
                                disabled={false}
                              >
                                Already connected
                              </button>
                            );
                          }

                          return (
                            <button
                              type="button"
                              className="btn-army disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                const summary =
                                  (l.seats?.length ?? 0) > 0
                                    ? `${l.concertCity} · ${l.concertDate} · ${l.seats!.length} seat${l.seats!.length === 1 ? "" : "s"}`
                                    : `${l.concertCity} · ${l.concertDate}`;
                                if (isLocked) {
                                  setLockedExplain({ summary, lockExpiresAt: l.lockExpiresAt });
                                  return;
                                }
                                setConnectConfirm({ listingId: l.listingId, summary });
                              }}
                              disabled={connectingId === l.listingId || isSold}
                            >
                              {isSold ? "SOLD" : isLocked ? "LOCKED" : connectingId === l.listingId ? "Connecting…" : "CONNECT"}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        ) : mineDisplay.length === 0 ? (
          <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-10 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
            {mine.length === 0 ? "You haven't posted any listings yet." : "You have no active listings (sold and removed are hidden)."}
          </p>
        ) : (
          <div className="space-y-4">
            {mineDisplay.map((l) => {
              const s = listingStatusLabel(l);
              return (
                <div key={l.id} className="rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">
                          {l.concertCity} · {l.concertDate}
                        </p>
                        <span className="rounded-full bg-army-purple/10 px-2 py-0.5 text-xs font-medium text-army-purple dark:bg-army-purple/20 dark:text-army-300">
                          {l.seats.length} {l.seats.length === 1 ? "ticket" : "tickets"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                        <span className="font-semibold">Source:</span> {l.ticketSource}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>{s.label}</span>
                      {l.status !== "removed" && (
                        <button type="button" className="btn-army-outline" onClick={() => setEditing(l)} disabled={mutatingId === l.id}>
                          Edit
                        </button>
                      )}
                      {String(l.status) === "locked" && myActiveSellerConnectionByListingId.get(l.id) && (
                        <button
                          type="button"
                          className="btn-army-outline"
                          onClick={() => {
                            const c = myActiveSellerConnectionByListingId.get(l.id);
                            if (!c) return;
                            window.location.href = `/connections/${encodeURIComponent(c.id)}`;
                          }}
                        >
                          View active connection
                        </button>
                      )}
                      {l.status !== "removed" && l.status !== "sold" && (
                        <button type="button" className="btn-army" onClick={() => markSold(l.id)} disabled={mutatingId === l.id}>
                          Mark sold
                        </button>
                      )}
                      {l.status === "sold" && (
                        <button type="button" className="btn-army-outline" onClick={() => markNotSold(l.id)} disabled={mutatingId === l.id}>
                          Not sold
                        </button>
                      )}
                      {l.status !== "removed" && (
                        <button type="button" className="btn-army-outline" onClick={() => deleteListing(l.id)} disabled={mutatingId === l.id}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-neutral-700 dark:text-neutral-300 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold">Why selling:</span> {l.sellingReason}
                    </p>
                    <p>
                      <span className="font-semibold">Ticketing experience:</span> {l.ticketingExperience}
                    </p>
                  </div>
                  {l.priceExplanation?.trim() ? (
                    <div className="mt-3 rounded-xl border border-army-purple/10 bg-army-purple/5 p-3 text-sm text-neutral-800 dark:border-army-purple/20 dark:bg-army-purple/10 dark:text-neutral-200">
                      <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Price explanation</p>
                      <p className="mt-1 whitespace-pre-wrap break-words">{l.priceExplanation}</p>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Seats</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {l.seats.map((seat) => (
                        <div key={seat.seatIndex} className="rounded-xl border border-army-purple/10 bg-army-purple/5 p-3 dark:border-army-purple/20 dark:bg-army-purple/10">
                          <p className="text-sm font-semibold text-army-purple">
                            <span className="font-semibold">Section:</span> {seat.section}
                            <span className="mx-1">·</span>
                            <span className="font-semibold">Row:</span> {seat.seatRow}
                            <span className="mx-1">·</span>
                            <span className="font-semibold">Seat:</span> {seat.seat}
                          </p>
                          <p className="text-sm text-neutral-700 dark:text-neutral-300">
                            {formatPrice(seat.faceValuePrice, seat.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lockedExplain && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="locked-explainer-title"
          onClick={() => setLockedExplain(null)}
        >
          <div
            className="modal-panel w-full max-w-lg cursor-default overflow-hidden rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="locked-explainer-title" className="font-display text-xl font-bold text-army-purple">
              What “Locked” means
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              This listing is locked because either the seller accepted a connection request, or it has already reached the limit of active requests (waiting list).{" "}
              <span className="font-semibold">{lockedExplain.summary}</span>
            </p>

            <div className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <p>
                While locked, no new connection requests can be sent. It will unlock when a slot opens in the waiting list—for example, when a buyer or seller ends or declines a connection—and the listing is not yet sold.
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                If the listing is marked sold or removed, it will not become available again.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-army" onClick={() => setLockedExplain(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {connectConfirm && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect-explainer-title"
          onClick={() => setConnectConfirm(null)}
        >
          <div
            className="modal-panel w-full max-w-lg cursor-default overflow-hidden rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="connect-explainer-title" className="font-display text-xl font-bold text-army-purple">
              What “Connect” means
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              You’re about to request a connection for: <span className="font-semibold">{connectConfirm.summary}</span>
            </p>

            <div className="mt-4 space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
              <div className="rounded-xl border border-army-purple/25 bg-army-purple/5 p-4">
                <p className="font-semibold text-army-purple">Security note</p>
                <p className="mt-1">
                  For our precious ARMY security, the chat inside the app is no longer available. You will exchange your social media instead when accepted.
                </p>
              </div>
              <p>
                <span className="font-semibold">Limits:</span> up to <span className="font-semibold">3</span> active connection requests; up to <span className="font-semibold">3</span> active listings at a time (sold and removed do not count). Once a seller has <span className="font-semibold">3</span> active connections, their listing is locked to new requests. Contact socials are <span className="font-semibold">Instagram or Facebook</span> only.
              </p>
              <div>
                <p className="font-semibold text-army-purple">How it works (high level)</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>
                    <span className="font-semibold">Connect</span>: choose whether to share socials with this seller, and answer 2 bonding questions (once per account) if you haven’t already.
                  </li>
                  <li>
                    <span className="font-semibold">Request sent</span>: seller has up to <span className="font-semibold">24 hours</span> to accept or decline.
                  </li>
                  <li>
                    <span className="font-semibold">If accepted</span>: seller chooses whether to share socials; you both see the match message. If you both chose to share socials, your <strong>Instagram or Facebook</strong> are shown so you can contact each other.
                  </li>
                  <li>
                    <span className="font-semibold">Agreement</span>: you both confirm the match (24 hours), then chat is open.
                  </li>
                </ol>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                If steps time out, the connection can expire and the listing can unlock.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-army-outline" onClick={() => setConnectConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-army"
                onClick={() => {
                  setConnectV2({ listingId: connectConfirm.listingId, summary: connectConfirm.summary });
                  setConnectConfirm(null);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {connectV2 && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect-v2-title"
          onClick={() => setConnectV2(null)}
        >
          <div
            className="modal-panel w-full max-w-lg cursor-default overflow-y-auto max-h-[90vh] rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="connect-v2-title" className="font-display text-xl font-bold text-army-purple">
              Connect to listing
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {connectV2.summary}
            </p>

            <div className="mt-4 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 dark:border-army-purple/25 dark:bg-army-purple/10">
              <p className="text-sm font-semibold text-army-purple">Seller profile</p>
              {connectV2SellerProfile.loading && (
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Loading seller profile…</p>
              )}
              {connectV2SellerProfile.error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{connectV2SellerProfile.error}</p>
              )}
              {connectV2SellerProfile.data && !connectV2SellerProfile.loading && (
                <div className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <p><span className="font-medium text-army-purple">Username:</span> {connectV2SellerProfile.data.username}</p>
                  {connectV2SellerProfile.data.country && (
                    <p><span className="font-medium text-army-purple">Country:</span> {connectV2SellerProfile.data.country}</p>
                  )}
                  <p><span className="font-medium text-army-purple">Where ticket was bought:</span> {connectV2SellerProfile.data.ticketSource || "—"}</p>
                  <p><span className="font-medium text-army-purple">Ticketing experience:</span> {connectV2SellerProfile.data.ticketingExperience || "—"}</p>
                  <p><span className="font-medium text-army-purple">Why selling:</span> {connectV2SellerProfile.data.sellingReason || "—"}</p>
                  {(connectV2SellerProfile.data.armyBiasAnswer || connectV2SellerProfile.data.armyYearsArmy || connectV2SellerProfile.data.armyFavoriteAlbum) && (
                    <div className="mt-2 space-y-1">
                      <p className="font-medium text-army-purple">ARMY profile</p>
                      {connectV2SellerProfile.data.armyBiasAnswer && (
                        <div>
                          <p className="text-xs text-army-purple/80">{connectV2SellerProfile.data.armyBiasPrompt}</p>
                          <p className="whitespace-pre-wrap">{connectV2SellerProfile.data.armyBiasAnswer}</p>
                        </div>
                      )}
                      {connectV2SellerProfile.data.armyYearsArmy && (
                        <div>
                          <p className="text-xs text-army-purple/80">{connectV2SellerProfile.data.armyYearsArmyPrompt}</p>
                          <p className="whitespace-pre-wrap">{connectV2SellerProfile.data.armyYearsArmy}</p>
                        </div>
                      )}
                      {connectV2SellerProfile.data.armyFavoriteAlbum && (
                        <div>
                          <p className="text-xs text-army-purple/80">{connectV2SellerProfile.data.armyFavoriteAlbumPrompt}</p>
                          <p className="whitespace-pre-wrap">{connectV2SellerProfile.data.armyFavoriteAlbum}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {connectV2SellerProfile.data.bondingAnswers.filter((b) => b.prompt || b.answer).length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="font-medium text-army-purple">Bonding answers:</p>
                      {connectV2SellerProfile.data.bondingAnswers.map((b, idx) => (
                        <div key={idx}>
                          <p className="text-xs text-army-purple/80">{b.prompt}</p>
                          <p className="whitespace-pre-wrap">{b.answer || "—"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-army-purple">Do you want to share socials with this seller?</p>
              <p className="mt-1 text-xs text-neutral-500">If you both agree later, you’ll see each other’s socials in the match message.</p>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="connectV2Social"
                    checked={connectV2SocialShare === true}
                    onChange={() => setConnectV2SocialShare(true)}
                  />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="connectV2Social"
                    checked={connectV2SocialShare === false}
                    onChange={() => setConnectV2SocialShare(false)}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            {connectV2HasBonding === false && connectV2Prompts.length >= 2 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-semibold text-army-purple">Answer these 2 questions to build trust with the seller</p>
                {connectV2Prompts.map((q) => (
                  <div key={q.id}>
                    <label className="block text-sm text-neutral-700 dark:text-neutral-300">{q.prompt}</label>
                    <textarea
                      className="input-army mt-1 w-full min-h-[80px]"
                      value={connectV2BondingAnswers[q.id] ?? ""}
                      onChange={(e) => setConnectV2BondingAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Your answer…"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-army-outline" onClick={() => setConnectV2(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-army"
                onClick={() => void connectV2Submit()}
                disabled={
                  connectingId === connectV2.listingId ||
                  connectV2SocialShare === null ||
                  connectV2HasBonding === null ||
                  (connectV2HasBonding === false && connectV2Prompts.length < 2)
                }
              >
                {connectingId === connectV2.listingId ? "Connecting…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {limitOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="limit-modal-title"
          onClick={() => setLimitOpen(null)}
        >
          <div
            className="modal-panel w-full max-w-lg cursor-default overflow-hidden rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="limit-modal-title" className="font-display text-xl font-bold text-army-purple">
              {limitOpen.title}
            </h2>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{limitOpen.body}</p>
            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-army" onClick={() => setLimitOpen(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {showMigrationBondingModal && migrationBondingPrompts.length >= 2 && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="migration-bonding-title"
        >
          <div
            className="modal-panel w-full max-w-lg cursor-default overflow-hidden rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
          >
            <h2 id="migration-bonding-title" className="font-display text-xl font-bold text-army-purple">
              Build trust with buyers
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Add your bonding answers now. They will be shown to buyers when they connect to your listings. You only need to do this once.
              Please answer the questions below to simplify the bonding stage from now onwards. This step is required to continue.
            </p>
            <div className="mt-4 space-y-3">
              {migrationBondingPrompts.map((q) => (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-army-purple">{q.prompt}</label>
                  <textarea
                    className="input-army mt-1 w-full min-h-[80px]"
                    value={migrationBondingAnswers[q.id] ?? ""}
                    onChange={(e) => setMigrationBondingAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Your answer…"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-army" onClick={() => void migrationBondingSubmit()} disabled={migrationBondingSubmitting}>
                {migrationBondingSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {listingDetailsOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="listing-details-title"
          onClick={() => setListingDetailsOpen(null)}
        >
          <div
            className="modal-panel w-full max-w-lg cursor-default overflow-hidden rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="listing-details-title" className="font-display text-xl font-bold text-army-purple">
              Seller details
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {listingDetailsOpen.summary}
            </p>
            {listingDetailsFetch?.loading && (
              <p className="mt-4 text-sm text-neutral-500">Loading…</p>
            )}
            {listingDetailsFetch?.error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{listingDetailsFetch.error}</p>
            )}
            {listingDetailsFetch && !listingDetailsFetch.loading && !listingDetailsFetch.error && listingDetailsFetch.data && (
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-army-purple">Where ticket was bought</p>
                  <p className="mt-1 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                    {listingDetailsFetch.data.ticketSource || "—"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-army-purple">Ticketing experience</p>
                  <p className="mt-1 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                    {listingDetailsFetch.data.ticketingExperience || "—"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-army-purple">Why sell to the buyers</p>
                  <p className="mt-1 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                    {listingDetailsFetch.data.sellingReason || "—"}
                  </p>
                </div>
                {listingDetailsFetch.data.priceExplanation?.trim() && (
                  <div>
                    <p className="font-semibold text-army-purple">Price explanation</p>
                    <p className="mt-1 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-words">
                      {listingDetailsFetch.data.priceExplanation.trim()}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-army" onClick={() => setListingDetailsOpen(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {ticketDetailsOpen && (
        <ConnectionTicketDetailsModal
          open={true}
          onClose={() => setTicketDetailsOpen(null)}
          connectionId={ticketDetailsOpen.connectionId}
        />
      )}

      <PostListingModal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => {
          void load();
          setTab("my");
        }}
      />

      <ListingReportModal
        open={!!reportOpen}
        onClose={() => setReportOpen(null)}
        listing={reportOpen ? { listingId: reportOpen.listingId, summary: reportOpen.summary } : null}
        onReported={() => setError("Thanks — your report was submitted.")}
      />

      <EditListingModal
        open={!!editing}
        onClose={() => setEditing(null)}
        listing={editing}
        onSaved={() => {
          void load();
          setTab("my");
        }}
      />
      </div>
    </RequireAuth>
  );
}

