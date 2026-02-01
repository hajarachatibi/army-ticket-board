"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import EditListingModal from "@/components/EditListingModal";
import RequireAuth from "@/components/RequireAuth";
import ListingReportModal from "@/components/ListingReportModal";
import PostListingModal from "@/components/PostListingModal";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";
import { connectToListing, fetchBrowseListings, fetchMyListings, type BrowseListingCard, type MyListing } from "@/lib/supabase/listings";
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
  if (s === "processing") {
    return { label: "Processing", cls: "bg-army-purple/10 text-army-purple dark:text-army-300" };
  }
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
  const [connections, setConnections] = useState<Array<{ id: string; stage: string; stageExpiresAt: string; listingId: string }>>([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterCity, setFilterCity] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPriceMin, setFilterPriceMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "locked" | "sold">("");

  const [postOpen, setPostOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState<{ listingId: string; summary: string } | null>(null);
  const [editing, setEditing] = useState<MyListing | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const [b, m, c] = await Promise.all([
      fetchBrowseListings(),
      fetchMyListings(user.id),
      supabase
        .from("connections")
        .select("id, stage, stage_expires_at, listing_id")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
    ]);
    if (b.error) setError(b.error);
    if (m.error) setError(m.error);
    setBrowse(b.data);
    setMine(m.data);
    if ((c as any).error) setError(String((c as any).error.message ?? "Failed to load connections"));
    else {
      const rows = (((c as any).data ?? []) as any[]).map((r) => ({
        id: String(r.id),
        stage: String(r.stage ?? ""),
        stageExpiresAt: String(r.stage_expires_at ?? ""),
        listingId: String(r.listing_id ?? ""),
      }));
      setConnections(rows);
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
    return mine.filter((l) => l.status === "processing" || l.status === "active" || l.status === "locked").length;
  }, [mine]);

  const browseCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const l of browse) {
      const c = String(l.currency ?? "").trim();
      if (c) set.add(c);
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

  const filteredBrowse = useMemo(() => {
    const city = filterCity.trim();
    const min = filterPriceMin.trim() ? Number(filterPriceMin) : null;
    const max = filterPriceMax.trim() ? Number(filterPriceMax) : null;
    const from = filterDateFrom.trim();
    const to = filterDateTo.trim();
    const currency = filterCurrency.trim();
    const status = filterStatus;

    return browse.filter((l) => {
      if (status && String(l.status) !== status) return false;
      if (city && String(l.concertCity ?? "") !== city) return false;
      if (currency && String(l.currency) !== currency) return false;

      const d = String(l.concertDate ?? "");
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;

      const price = Number(l.faceValuePrice ?? 0);
      if (min != null && Number.isFinite(min) && price < min) return false;
      if (max != null && Number.isFinite(max) && price > max) return false;
      return true;
    });
  }, [browse, filterCity, filterCurrency, filterDateFrom, filterDateTo, filterPriceMax, filterPriceMin, filterStatus]);

  const connect = async (listingId: string) => {
    if (!user) return;
    setConnectingId(listingId);
    setError(null);
    const { connectionId, error: e } = await connectToListing(listingId);
    setConnectingId(null);
    if (e) {
      setError(e);
      return;
    }
    if (connectionId) {
      window.location.href = `/connections/${encodeURIComponent(connectionId)}`;
    }
  };

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
            <Link href="/channel" className="btn-army-outline">
              Admin Channel
            </Link>
            <button
              type="button"
              className="btn-army disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setPostOpen(true)}
              disabled={activeListingsCount >= 5}
              title={activeListingsCount >= 5 ? "Max 5 active listings" : "Post a listing"}
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
                className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ${
                  tab === "connections" ? "bg-white" : "bg-army-purple"
                }`}
                aria-label="Unread connection updates"
              />
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

      {activeListingsCount >= 5 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          You can have a maximum of <span className="font-semibold">5 active listings</span> at a time.
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
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-army-purple/25 dark:bg-neutral-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Stage</p>
                      <p className="mt-1 font-display text-lg font-bold text-army-purple">{c.stage}</p>
                      {c.stageExpiresAt ? (
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          Expires: {new Date(c.stageExpiresAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    <div className="relative">
                      {unreadConnectionIds.has(c.id) && (
                        <span
                          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-army-purple"
                          aria-label="Unread updates for this connection"
                        />
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
              ))}
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
                      className="group rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-army-purple/25 dark:bg-neutral-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">{l.concertCity}</p>
                          <p className="mt-1 font-display text-lg font-bold text-army-purple">{l.concertDate}</p>
                        </div>
                        {(() => {
                          const pill = browseStatusPill(String(l.status));
                          return (
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>
                              {pill.label}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                        <span className="font-semibold">Seat:</span> {l.section} · {l.seatRow} · {l.seat}
                      </p>
                      <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                        <span className="font-semibold">Face value:</span> {formatPrice(l.faceValuePrice, l.currency)}
                      </p>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          className="btn-army-outline mr-2"
                          onClick={() =>
                            setReportOpen({
                              listingId: l.listingId,
                              summary: `${l.concertCity} · ${l.concertDate} · ${l.section} · ${l.seatRow} · ${l.seat}`,
                            })
                          }
                        >
                          Report
                        </button>
                        <button
                          type="button"
                          className="btn-army disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => connect(l.listingId)}
                          disabled={connectingId === l.listingId || String(l.status) === "sold" || String(l.status) === "locked"}
                        >
                          {String(l.status) === "sold"
                            ? "SOLD"
                            : String(l.status) === "locked"
                              ? "LOCKED"
                              : connectingId === l.listingId
                                ? "Connecting…"
                                : "CONNECT"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        ) : mine.length === 0 ? (
          <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-10 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
            You haven’t posted any listings yet.
          </p>
        ) : (
          <div className="space-y-4">
            {mine.map((l) => {
              const s = listingStatusLabel(l);
              return (
                <div key={l.id} className="rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">
                        {l.concertCity} · {l.concertDate}
                      </p>
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
                            {seat.section} · {seat.seatRow} · {seat.seat}
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

