"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatPrice } from "@/lib/data/currencies";
import { useAuth } from "@/lib/AuthContext";
import {
  adminBanAndDeleteUser,
  adminDeleteTicket,
  adminSendMessage,
  adminSendMessageToAllBuyers,
  adminSendMessageToAllSellers,
  adminSendMessageToAllUsers,
  fetchAdminBannedUsers,
  fetchAdminBuyersPage,
  fetchAdminMessageAllTotals,
  fetchAdminReports,
  fetchAdminSellersPage,
  fetchAdminTickets,
  type AdminReport,
  type AdminTicket,
  type AdminUser,
  type BannedUser,
} from "@/lib/supabase/admin";

type Tab = "reports" | "tickets" | "sellers" | "buyers" | "message" | "banned";

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function AdminPanelContent() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [ticketsPage, setTicketsPage] = useState(0);
  const [ticketsSearch, setTicketsSearch] = useState("");
  const [ticketsSearchApplied, setTicketsSearchApplied] = useState("");
  const [sellers, setSellers] = useState<AdminUser[]>([]);
  const [sellersTotal, setSellersTotal] = useState(0);
  const [sellersPage, setSellersPage] = useState(0);
  const [sellersSearch, setSellersSearch] = useState("");
  const [sellersSearchApplied, setSellersSearchApplied] = useState("");
  const [buyers, setBuyers] = useState<AdminUser[]>([]);
  const [buyersTotal, setBuyersTotal] = useState(0);
  const [buyersPage, setBuyersPage] = useState(0);
  const [buyersSearch, setBuyersSearch] = useState("");
  const [buyersSearchApplied, setBuyersSearchApplied] = useState("");
  const [banned, setBanned] = useState<BannedUser[]>([]);
  const [messageTotals, setMessageTotals] = useState({
    sellersTotal: 0,
    buyersTotal: 0,
    allTotal: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());

  const [messageText, setMessageText] = useState("");
  const [messageTo, setMessageTo] = useState<"all" | "sellers" | "buyers">("all");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageModalRecipients, setMessageModalRecipients] = useState<AdminUser[]>([]);
  const [messageModalText, setMessageModalText] = useState("");

  const clearFeedback = useCallback(() => {
    setActionFeedback(null);
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminReports();
    setLoading(false);
    if (e) setError(e);
    else if (data) setReports(data);
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, total, error: e } = await fetchAdminTickets({ page: ticketsPage, search: ticketsSearchApplied });
    setLoading(false);
    if (e) setError(e);
    else {
      if (data) setTickets(data);
      setTicketsTotal(total);
    }
  }, [ticketsPage, ticketsSearchApplied]);

  const loadSellers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, total, error: e } = await fetchAdminSellersPage({ page: sellersPage, search: sellersSearchApplied });
    setLoading(false);
    if (e) setError(e);
    else {
      if (data) setSellers(data);
      setSellersTotal(total);
    }
  }, [sellersPage, sellersSearchApplied]);

  const loadBuyers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, total, error: e } = await fetchAdminBuyersPage({ page: buyersPage, search: buyersSearchApplied });
    setLoading(false);
    if (e) setError(e);
    else {
      if (data) setBuyers(data);
      setBuyersTotal(total);
    }
  }, [buyersPage, buyersSearchApplied]);

  const loadBanned = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminBannedUsers();
    setLoading(false);
    if (e) setError(e);
    else if (data) setBanned(data);
  }, []);

  const loadMessageTotals = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { sellersTotal: s, buyersTotal: b, allTotal: a, error: e } = await fetchAdminMessageAllTotals();
    setLoading(false);
    if (e) setError(e);
    else setMessageTotals({ sellersTotal: s, buyersTotal: b, allTotal: a });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace("/");
      return;
    }
  }, [authLoading, user, isAdmin, router]);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    if (tab === "reports") loadReports();
    else if (tab === "tickets") loadTickets();
    else if (tab === "sellers") loadSellers();
    else if (tab === "buyers") loadBuyers();
    else if (tab === "message") loadMessageTotals();
    else if (tab === "banned") loadBanned();
  }, [user?.id, isAdmin, tab, loadReports, loadTickets, loadSellers, loadBuyers, loadMessageTotals, loadBanned]);

  useEffect(() => {
    if (tab === "tickets") loadTickets();
  }, [ticketsPage, ticketsSearchApplied, tab, loadTickets]);

  useEffect(() => {
    if (tab === "sellers") loadSellers();
  }, [sellersPage, sellersSearchApplied, tab, loadSellers]);

  useEffect(() => {
    setSelectedSellers(new Set());
  }, [sellersPage]);

  useEffect(() => {
    if (tab === "buyers") loadBuyers();
  }, [buyersPage, buyersSearchApplied, tab, loadBuyers]);

  useEffect(() => {
    setSelectedBuyers(new Set());
  }, [buyersPage]);

  const handleBanAndDelete = useCallback(
    async (email: string) => {
      if (!email) return;
      const { error: e } = await adminBanAndDeleteUser(email);
      if (e) {
        setActionFeedback(`Error: ${e}`);
        return false;
      }
      return true;
    },
    []
  );

  const handleBanAndDeleteMultiple = useCallback(
    async (users: AdminUser[]) => {
      let done = 0;
      for (const u of users) {
        const ok = await handleBanAndDelete(u.email);
        if (ok) done++;
      }
      setActionFeedback(`Banned and deleted ${done} user(s).`);
      setSelectedSellers(new Set());
      setSelectedBuyers(new Set());
      loadSellers();
      loadBuyers();
      loadBanned();
      loadReports();
      loadTickets();
    },
    [handleBanAndDelete, loadSellers, loadBuyers, loadBanned, loadReports, loadTickets]
  );

  const handleDeleteTicket = useCallback(async (ticketId: string) => {
    const { error: e } = await adminDeleteTicket(ticketId);
    if (e) {
      setActionFeedback(`Error: ${e}`);
      return;
    }
    setActionFeedback("Ticket deleted.");
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    setTicketsTotal((n) => Math.max(0, n - 1));
  }, []);

  const openSendMessageModal = useCallback((users: AdminUser[]) => {
    setMessageModalRecipients(users);
    setMessageModalText("");
    setMessageModalOpen(true);
  }, []);

  const sendMessageToModalRecipients = useCallback(async () => {
    const text = messageModalText.trim();
    const recipients = messageModalRecipients;
    if (!text) {
      setActionFeedback("Enter a message.");
      return;
    }
    if (recipients.length === 0) {
      setActionFeedback("No recipients selected.");
      return;
    }
    const ids = recipients.map((u) => u.id).filter(Boolean);
    if (ids.length === 0) {
      setActionFeedback("No valid recipients.");
      return;
    }
    setSendingMessage(true);
    setActionFeedback(null);
    try {
      const { error: e } = await adminSendMessage(ids, text);
      if (e) {
        setActionFeedback(`Error: ${e}`);
        return;
      }
      setActionFeedback(`Message sent to ${ids.length} user(s).`);
      setMessageModalOpen(false);
    } finally {
      setSendingMessage(false);
    }
  }, [messageModalText, messageModalRecipients]);

  const sendMessageToAll = useCallback(async () => {
    if (!messageText.trim()) return;
    const msg = messageText.trim();
    setSendingMessage(true);
    let count = 0;
    let err: string | null = null;
    if (messageTo === "all") {
      const r = await adminSendMessageToAllUsers(msg);
      count = r.count;
      err = r.error;
    } else if (messageTo === "sellers") {
      const r = await adminSendMessageToAllSellers(msg);
      count = r.count;
      err = r.error;
    } else {
      const r = await adminSendMessageToAllBuyers(msg);
      count = r.count;
      err = r.error;
    }
    setSendingMessage(false);
    if (err) {
      setActionFeedback(`Error: ${err}`);
      return;
    }
    setActionFeedback(`Message sent to ${count} user(s).`);
    setMessageText("");
    loadMessageTotals();
  }, [messageText, messageTo, loadMessageTotals]);

  const toggleSeller = useCallback((id: string) => {
    setSelectedSellers((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleBuyer = useCallback((id: string) => {
    setSelectedBuyers((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (authLoading || !user || !isAdmin) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-center text-army-purple">Loading…</p>
        </div>
      </main>
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "reports", label: "Reports" },
    { id: "tickets", label: "Tickets" },
    { id: "sellers", label: "Sellers" },
    { id: "buyers", label: "Buyers" },
    { id: "message", label: "Message all" },
    { id: "banned", label: "Banned users" },
  ];

  const selectedSellerUsers = sellers.filter((u) => selectedSellers.has(u.id));
  const selectedBuyerUsers = buyers.filter((u) => selectedBuyers.has(u.id));

  return (
    <main className="min-h-screen bg-gradient-army-subtle">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold text-army-purple">Admin</h1>
          <Link href="/tickets" className="btn-army-outline text-sm">
            Back to Tickets
          </Link>
        </div>

        {error && (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            role="alert"
          >
            {error}
          </div>
        )}
        {actionFeedback && (
          <div
            className="mt-4 flex items-center justify-between rounded-lg border border-army-purple/20 bg-army-purple/5 px-4 py-2 text-sm text-army-purple dark:bg-army-purple/10"
            role="status"
          >
            <span>{actionFeedback}</span>
            <button type="button" onClick={clearFeedback} className="text-army-purple/80 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-b border-army-purple/15 pb-4">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === id
                  ? "bg-army-purple text-white"
                  : "bg-white text-neutral-700 hover:bg-army-purple/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-army-purple/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "reports" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Reports</h2>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : reports.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No reports.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Date</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Event</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">City · Day</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Section · Row · Seat</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Type · Qty</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Price</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Status</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Owner email</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Reporter</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Reason</th>
                          <th className="min-w-[200px] max-w-[320px] px-3 py-2 font-semibold text-army-purple dark:text-army-300">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(r.createdAt)}</td>
                            <td className="whitespace-nowrap px-3 py-2 font-medium text-army-purple dark:text-army-300">{r.ticketEvent}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.ticketCity} · {r.ticketDay}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.ticketSection} · {r.ticketRow} · {r.ticketSeat}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.ticketType} · {r.ticketQuantity}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.ticketPrice > 0 ? formatPrice(r.ticketPrice, r.ticketCurrency) : "—"}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.ticketStatus}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.ownerEmail ?? "—"}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.reporterUsername ?? "—"}</td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{r.reason}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="max-h-24 min-w-[180px] max-w-[300px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded border border-army-purple/15 bg-neutral-50/80 px-2 py-1.5 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                                {r.details ?? "—"}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "tickets" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Tickets</h2>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={ticketsSearch}
                  onChange={(e) => setTicketsSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = (e.target as HTMLInputElement).value;
                      setTicketsSearchApplied(v);
                      setTicketsPage(0);
                    }
                  }}
                  placeholder="Search by owner email…"
                  className="input-army w-64"
                />
                <button
                  type="button"
                  onClick={() => {
                    setTicketsSearchApplied(ticketsSearch);
                    setTicketsPage(0);
                  }}
                  className="btn-army rounded-lg px-4 py-2 text-sm"
                >
                  Search
                </button>
              </div>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : tickets.length === 0 && ticketsTotal === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No tickets.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
                    Page {ticketsPage + 1} · {ticketsTotal} total
                  </p>
                  <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Event</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">City · Day</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Price</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Status</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Owner email</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tickets.map((t) => (
                            <tr
                              key={t.id}
                              className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                            >
                              <td className="px-4 py-3 font-medium text-army-purple dark:text-army-300">{t.event}</td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.city} · {t.day}</td>
                              <td className="px-4 py-3">{t.price > 0 ? formatPrice(t.price, t.currency ?? "USD") : "—"}</td>
                              <td className="px-4 py-3">{t.status}</td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.ownerEmail ?? "—"}</td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTicket(t.id)}
                                  className="rounded bg-red-100 px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={ticketsPage === 0}
                      onClick={() => setTicketsPage((p) => Math.max(0, p - 1))}
                      className="btn-army-outline rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={(ticketsPage + 1) * 24 >= ticketsTotal}
                      onClick={() => setTicketsPage((p) => p + 1)}
                      className="btn-army-outline rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "sellers" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Sellers</h2>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={sellersSearch}
                  onChange={(e) => setSellersSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSellersSearchApplied((e.target as HTMLInputElement).value);
                      setSellersPage(0);
                    }
                  }}
                  placeholder="Search by name or email…"
                  className="input-army w-64"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSellersSearchApplied(sellersSearch);
                    setSellersPage(0);
                  }}
                  className="btn-army rounded-lg px-4 py-2 text-sm"
                >
                  Search
                </button>
              </div>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : sellers.length === 0 && sellersTotal === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No sellers.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
                    Page {sellersPage + 1} · {sellersTotal} total
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={selectedSellerUsers.length === 0}
                      onClick={() => {
                        if (confirm(`Ban and delete data for ${selectedSellerUsers.length} selected user(s)?`)) {
                          handleBanAndDeleteMultiple(selectedSellerUsers);
                        }
                      }}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Ban & delete selected ({selectedSellers.size})
                    </button>
                    <button
                      type="button"
                      disabled={selectedSellerUsers.length === 0}
                      onClick={() => openSendMessageModal(selectedSellerUsers)}
                      className="btn-army rounded-lg px-4 py-2 text-sm"
                    >
                      Send message to selected ({selectedSellers.size})
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                            <th className="w-10 px-4 py-3">
                              <input
                                type="checkbox"
                                checked={sellers.length > 0 && selectedSellers.size === sellers.length}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedSellers(new Set(sellers.map((u) => u.id)));
                                  else setSelectedSellers(new Set());
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Email</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sellers.map((u) => (
                            <tr
                              key={u.id}
                              className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedSellers.has(u.id)}
                                  onChange={() => toggleSeller(u.id)}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{u.email}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!confirm(`Ban and delete ${u.email}?`)) return;
                                      handleBanAndDelete(u.email).then((ok) => {
                                        if (ok) {
                                          setActionFeedback(`Banned and deleted ${u.email}`);
                                          loadSellers();
                                          loadBuyers();
                                          loadBanned();
                                          loadReports();
                                          loadTickets();
                                        }
                                      });
                                    }}
                                    className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                  >
                                    Ban
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openSendMessageModal([u])}
                                    className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  >
                                    Message
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={sellersPage === 0}
                      onClick={() => setSellersPage((p) => Math.max(0, p - 1))}
                      className="btn-army-outline rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={(sellersPage + 1) * 24 >= sellersTotal}
                      onClick={() => setSellersPage((p) => p + 1)}
                      className="btn-army-outline rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "buyers" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Buyers</h2>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={buyersSearch}
                  onChange={(e) => setBuyersSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setBuyersSearchApplied((e.target as HTMLInputElement).value);
                      setBuyersPage(0);
                    }
                  }}
                  placeholder="Search by name or email…"
                  className="input-army w-64"
                />
                <button
                  type="button"
                  onClick={() => {
                    setBuyersSearchApplied(buyersSearch);
                    setBuyersPage(0);
                  }}
                  className="btn-army rounded-lg px-4 py-2 text-sm"
                >
                  Search
                </button>
              </div>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : buyers.length === 0 && buyersTotal === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No buyers.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
                    Page {buyersPage + 1} · {buyersTotal} total
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={selectedBuyerUsers.length === 0}
                      onClick={() => {
                        if (confirm(`Ban and delete data for ${selectedBuyerUsers.length} selected user(s)?`)) {
                          handleBanAndDeleteMultiple(selectedBuyerUsers);
                        }
                      }}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Ban & delete selected ({selectedBuyers.size})
                    </button>
                    <button
                      type="button"
                      disabled={selectedBuyerUsers.length === 0}
                      onClick={() => openSendMessageModal(selectedBuyerUsers)}
                      className="btn-army rounded-lg px-4 py-2 text-sm"
                    >
                      Send message to selected ({selectedBuyers.size})
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                            <th className="w-10 px-4 py-3">
                              <input
                                type="checkbox"
                                checked={buyers.length > 0 && selectedBuyers.size === buyers.length}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedBuyers(new Set(buyers.map((u) => u.id)));
                                  else setSelectedBuyers(new Set());
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Email</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {buyers.map((u) => (
                            <tr
                              key={u.id}
                              className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedBuyers.has(u.id)}
                                  onChange={() => toggleBuyer(u.id)}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{u.email}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!confirm(`Ban and delete ${u.email}?`)) return;
                                      handleBanAndDelete(u.email).then((ok) => {
                                        if (ok) {
                                          setActionFeedback(`Banned and deleted ${u.email}`);
                                          loadSellers();
                                          loadBuyers();
                                          loadBanned();
                                          loadReports();
                                          loadTickets();
                                        }
                                      });
                                    }}
                                    className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                  >
                                    Ban
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openSendMessageModal([u])}
                                    className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  >
                                    Message
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={buyersPage === 0}
                      onClick={() => setBuyersPage((p) => Math.max(0, p - 1))}
                      className="btn-army-outline rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={(buyersPage + 1) * 24 >= buyersTotal}
                      onClick={() => setBuyersPage((p) => p + 1)}
                      className="btn-army-outline rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "message" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Message all</h2>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : (
                <div className="max-w-2xl space-y-4 rounded-xl border border-army-purple/15 bg-white/80 p-6 dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-army-purple dark:text-army-300">
                      Send to
                    </label>
                    <select
                      value={messageTo}
                      onChange={(e) => setMessageTo(e.target.value as "all" | "sellers" | "buyers")}
                      className="input-army w-full max-w-xs"
                    >
                      <option value="all">All users ({messageTotals.allTotal})</option>
                      <option value="sellers">Sellers only ({messageTotals.sellersTotal})</option>
                      <option value="buyers">Buyers only ({messageTotals.buyersTotal})</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-army-purple dark:text-army-300">
                      Message
                    </label>
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Same message will be sent to each user separately."
                      rows={4}
                      className="input-army w-full resize-y"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={
                      !messageText.trim() ||
                      sendingMessage ||
                      (messageTo === "all" && messageTotals.allTotal === 0) ||
                      (messageTo === "sellers" && messageTotals.sellersTotal === 0) ||
                      (messageTo === "buyers" && messageTotals.buyersTotal === 0)
                    }
                    onClick={sendMessageToAll}
                    className="btn-army rounded-lg px-4 py-2 disabled:opacity-50"
                  >
                    {sendingMessage ? "Sending…" : "Send to all"}
                  </button>
                </div>
              )}
            </section>
          )}

          {tab === "banned" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Banned users</h2>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : banned.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No banned users.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Email</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Banned at</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {banned.map((b) => (
                          <tr
                            key={b.email}
                            className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                          >
                            <td className="px-4 py-3 font-medium text-army-purple dark:text-army-300">{b.email}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">{formatDate(b.bannedAt)}</td>
                            <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{b.reason ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {messageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !sendingMessage && setMessageModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-army-purple">Send message</h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              To {messageModalRecipients.length} user(s)
            </p>
            <textarea
              value={messageModalText}
              onChange={(e) => setMessageModalText(e.target.value)}
              placeholder="Your message…"
              rows={4}
              className="input-army mt-4 w-full resize-y"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMessageModalOpen(false)}
                disabled={sendingMessage}
                className="btn-army-outline rounded-lg px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendMessageToModalRecipients}
                disabled={!messageModalText.trim() || sendingMessage}
                className="btn-army rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              >
                {sendingMessage ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
