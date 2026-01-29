"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatPrice } from "@/lib/data/currencies";
import { useAuth } from "@/lib/AuthContext";
import AdminChatModal from "@/components/AdminChatModal";
import {
  adminBanAndDeleteUser,
  adminDeleteReport,
  adminDeleteTicket,
  adminUnbanUser,
  fetchAdminBannedUsers,
  fetchAdminBuyersPage,
  fetchAdminDashboardStats,
  fetchAdminInactiveUsersPage,
  fetchAdminReports,
  fetchAdminSellersPage,
  fetchAdminTickets,
  type AdminDashboardStats,
  type AdminReport,
  type AdminTicket,
  type AdminUser,
  type BannedUser,
} from "@/lib/supabase/admin";
import { adminGetOrCreateChat, type AdminChat } from "@/lib/supabase/adminChats";

type Tab = "dashboard" | "reports" | "tickets" | "sellers" | "buyers" | "inactive" | "banned";

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
  const [tab, setTab] = useState<Tab>("dashboard");
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
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats | null>(null);
  const [inactive, setInactive] = useState<AdminUser[]>([]);
  const [inactiveTotal, setInactiveTotal] = useState(0);
  const [inactivePage, setInactivePage] = useState(0);
  const [inactiveDays, setInactiveDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());

  const [adminChatOpen, setAdminChatOpen] = useState<{ chat: AdminChat; userEmail: string } | null>(null);

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

  const loadDashboardStats = useCallback(async () => {
    const { data, error: e } = await fetchAdminDashboardStats();
    if (e) setError(e);
    else if (data) setDashboardStats(data);
  }, []);

  const loadInactive = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, total, error: e } = await fetchAdminInactiveUsersPage({
      page: inactivePage,
      inactiveDays,
    });
    setLoading(false);
    if (e) setError(e);
    else {
      if (data) setInactive(data);
      setInactiveTotal(total);
    }
  }, [inactivePage, inactiveDays]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace("/");
      return;
    }
  }, [authLoading, user, isAdmin, router]);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    if (tab === "dashboard") loadDashboardStats();
    else if (tab === "reports") loadReports();
    else if (tab === "tickets") loadTickets();
    else if (tab === "sellers") loadSellers();
    else if (tab === "buyers") loadBuyers();
    else if (tab === "inactive") loadInactive();
    else if (tab === "banned") loadBanned();
  }, [user?.id, isAdmin, tab, loadDashboardStats, loadReports, loadTickets, loadSellers, loadBuyers, loadInactive, loadBanned]);

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

  useEffect(() => {
    if (tab === "inactive") loadInactive();
  }, [tab, inactivePage, inactiveDays, loadInactive]);

  const handleDeleteReport = useCallback(async (reportId: string) => {
    const { error: e } = await adminDeleteReport(reportId);
    if (e) {
      setActionFeedback(`Error: ${e}`);
      return;
    }
    setActionFeedback("Report deleted.");
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }, []);

  const handleUnban = useCallback(async (email: string) => {
    const { error: e } = await adminUnbanUser(email);
    if (e) {
      setActionFeedback(`Error: ${e}`);
      return;
    }
    setActionFeedback(`Unbanned ${email}.`);
    setBanned((prev) => prev.filter((b) => b.email !== email));
  }, []);

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

  const openAdminChat = useCallback(async (u: AdminUser) => {
    setActionFeedback(null);
    const { data: chat, error: e } = await adminGetOrCreateChat(u.id);
    if (e) {
      setActionFeedback(`Error: ${e}`);
      return;
    }
    if (!chat) {
      setActionFeedback("Could not open chat.");
      return;
    }
    setAdminChatOpen({ chat, userEmail: u.email });
  }, []);

  const openAdminChatByIdAndEmail = useCallback(async (userId: string, email: string) => {
    setActionFeedback(null);
    const { data: chat, error: e } = await adminGetOrCreateChat(userId);
    if (e) {
      setActionFeedback(`Error: ${e}`);
      return;
    }
    if (!chat) {
      setActionFeedback("Could not open chat.");
      return;
    }
    setAdminChatOpen({ chat, userEmail: email });
  }, []);

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
    { id: "dashboard", label: "Dashboard" },
    { id: "reports", label: "Reports" },
    { id: "tickets", label: "Tickets" },
    { id: "sellers", label: "Sellers" },
    { id: "buyers", label: "Buyers" },
    { id: "inactive", label: "Inactive users" },
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
          {tab === "dashboard" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Dashboard</h2>
              {!dashboardStats ? (
                <p className="text-neutral-500">Loading…</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <p className="text-sm font-medium text-army-purple dark:text-army-300">Users</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-800 dark:text-neutral-200">{dashboardStats.users}</p>
                  </div>
                  <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <p className="text-sm font-medium text-army-purple dark:text-army-300">Tickets</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-800 dark:text-neutral-200">{dashboardStats.tickets}</p>
                  </div>
                  <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <p className="text-sm font-medium text-army-purple dark:text-army-300">Reports</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-800 dark:text-neutral-200">{dashboardStats.reports}</p>
                  </div>
                  <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <p className="text-sm font-medium text-army-purple dark:text-army-300">Sellers</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-800 dark:text-neutral-200">{dashboardStats.sellers}</p>
                  </div>
                  <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <p className="text-sm font-medium text-army-purple dark:text-army-300">Buyers</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-800 dark:text-neutral-200">{dashboardStats.buyers}</p>
                  </div>
                  <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <p className="text-sm font-medium text-army-purple dark:text-army-300">Banned</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-800 dark:text-neutral-200">{dashboardStats.banned}</p>
                  </div>
                </div>
              )}
            </section>
          )}

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
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
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
                            <td className="whitespace-nowrap px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {r.reporterId && (
                                  <button
                                    type="button"
                                    onClick={() => openAdminChatByIdAndEmail(r.reporterId!, r.reporterEmail ?? r.reporterUsername ?? "Reporter")}
                                    className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  >
                                    Chat reporter
                                  </button>
                                )}
                                {r.ownerId && (
                                  <button
                                    type="button"
                                    onClick={() => openAdminChatByIdAndEmail(r.ownerId!, r.ownerEmail ?? "Owner")}
                                    className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  >
                                    Chat owner
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!confirm("Delete this report?")) return;
                                    handleDeleteReport(r.id);
                                  }}
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                >
                                  Delete
                                </button>
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
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Joined</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Last login</th>
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
                              <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">{formatDate(u.createdAt)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">{formatDate(u.lastLoginAt)}</td>
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
                                    onClick={() => openAdminChat(u)}
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
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Joined</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Last login</th>
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
                              <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">{formatDate(u.createdAt)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">{formatDate(u.lastLoginAt)}</td>
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
                                    onClick={() => openAdminChat(u)}
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

          {tab === "inactive" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Inactive users</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                Users who have not logged in for the selected number of days, or never.
              </p>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium">Inactive for</label>
                <select
                  value={inactiveDays}
                  onChange={(e) => {
                    setInactiveDays(Number(e.target.value));
                    setInactivePage(0);
                  }}
                  className="input-army w-32"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : inactive.length === 0 && inactiveTotal === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No inactive users.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
                    Page {inactivePage + 1} · {inactiveTotal} total
                  </p>
                  <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Email</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Joined</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Last login</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inactive.map((u) => (
                            <tr
                              key={u.id}
                              className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                            >
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{u.email}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">{formatDate(u.createdAt)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">{formatDate(u.lastLoginAt)}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!confirm(`Ban and delete ${u.email}?`)) return;
                                      handleBanAndDelete(u.email).then((ok) => {
                                        if (ok) {
                                          setActionFeedback(`Banned and deleted ${u.email}`);
                                          loadInactive();
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
                                    onClick={() => openAdminChat(u)}
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
                      disabled={inactivePage === 0}
                      onClick={() => setInactivePage((p) => Math.max(0, p - 1))}
                      className="btn-army-outline rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={(inactivePage + 1) * 24 >= inactiveTotal}
                      onClick={() => setInactivePage((p) => p + 1)}
                      className="btn-army-outline rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </>
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
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Actions</th>
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
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => handleUnban(b.email)}
                                className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                              >
                                Unban
                              </button>
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
        </div>
      </div>

      {adminChatOpen && (
        <AdminChatModal
          adminChat={adminChatOpen.chat}
          userEmail={adminChatOpen.userEmail}
          onClose={() => setAdminChatOpen(null)}
          onStatusChange={() => {}}
        />
      )}
    </main>
  );
}
