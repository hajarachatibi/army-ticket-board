"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatPrice } from "@/lib/data/currencies";
import { useAuth } from "@/lib/AuthContext";
import AdminChatModal from "@/components/AdminChatModal";
import {
  adminApproveTicket,
  adminBanAndDeleteUser,
  adminClaimTicket,
  adminDeleteReport,
  adminDeleteTicket,
  adminRejectTicket,
  adminUnbanUser,
  fetchAdminBannedUsers,
  fetchAdminBuyersPage,
  fetchAdminDashboardStats,
  fetchAdminPendingTickets,
  fetchAdminReports,
  fetchAdminSellersPage,
  fetchAdminTicketsFiltered,
  type AdminDashboardStats,
  type AdminPendingTicket,
  type AdminReport,
  type AdminTicket,
  type AdminUser,
  type BannedUser,
} from "@/lib/supabase/admin";
import { adminGetOrCreateChat, type AdminChat } from "@/lib/supabase/adminChats";

type Tab = "dashboard" | "reports" | "pending" | "tickets" | "sellers" | "buyers" | "banned";

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
  const [ticketsSearch, setTicketsSearch] = useState("");
  const [ticketsSearchApplied, setTicketsSearchApplied] = useState("");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [ticketsPage, setTicketsPage] = useState(0);
  const [ticketsFilter, setTicketsFilter] = useState<
    "available_approved" | "available_unclaimed" | "available_rejected" | "sold"
  >("available_approved");
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
  const [pendingTickets, setPendingTickets] = useState<AdminPendingTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());

  const [adminChatOpen, setAdminChatOpen] = useState<{ chat: AdminChat; userEmail: string } | null>(null);
  const [ticketDetailsOpen, setTicketDetailsOpen] = useState<AdminTicket | null>(null);
  const [reportTicketOpen, setReportTicketOpen] = useState<AdminReport | null>(null);
  const [reportUserOpen, setReportUserOpen] = useState<{ userId: string | null; email: string | null; title: string } | null>(null);
  const [rejectReasonOpen, setRejectReasonOpen] = useState<{ ticketId: string; ownerEmail: string | null } | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState("");

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

  const loadTicketsFiltered = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filter = ticketsFilter;
    const params =
      filter === "sold"
        ? { ticketStatus: "Sold" as const, listingStatus: null, claimedState: null }
        : filter === "available_unclaimed"
          ? {
              ticketStatus: "Available" as const,
              listingStatus: "pending_review" as const,
              claimedState: "unclaimed" as const,
            }
          : filter === "available_rejected"
            ? { ticketStatus: "Available" as const, listingStatus: "rejected" as const, claimedState: null }
            : { ticketStatus: "Available" as const, listingStatus: "approved" as const, claimedState: null };

    const { data, total, error: e } = await fetchAdminTicketsFiltered({
      page: ticketsPage,
      search: ticketsSearchApplied,
      ticketStatus: params.ticketStatus,
      listingStatus: params.listingStatus,
      claimedState: params.claimedState,
    });
    setLoading(false);
    if (e) {
      setError(e);
      return;
    }
    setTickets(data);
    setTicketsTotal(total);
  }, [ticketsPage, ticketsSearchApplied, ticketsFilter]);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminPendingTickets();
    setLoading(false);
    if (e) setError(e);
    else if (data) setPendingTickets(data);
  }, []);

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
    else if (tab === "pending") loadPending();
    else if (tab === "tickets") loadTicketsFiltered();
    else if (tab === "sellers") loadSellers();
    else if (tab === "buyers") loadBuyers();
    else if (tab === "banned") loadBanned();
  }, [user?.id, isAdmin, tab, loadDashboardStats, loadReports, loadPending, loadTicketsFiltered, loadSellers, loadBuyers, loadBanned]);

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
      loadTicketsFiltered();
    },
    [handleBanAndDelete, loadSellers, loadBuyers, loadBanned, loadReports, loadTicketsFiltered]
  );

  const handleDeleteTicket = useCallback(async (ticketId: string) => {
    const { error: e } = await adminDeleteTicket(ticketId);
    if (e) {
      setActionFeedback(`Error: ${e}`);
      return;
    }
    setActionFeedback("Ticket deleted.");
    setReports((prev) => prev.filter((r) => r.ticketId !== ticketId));
    setPendingTickets((prev) => prev.filter((t) => t.id !== ticketId));
    setTicketDetailsOpen((t) => (t?.id === ticketId ? null : t));
    setReportTicketOpen((r) => (r?.ticketId === ticketId ? null : r));
    await Promise.all([loadTicketsFiltered(), loadPending(), loadReports()]);
  }, [loadTicketsFiltered, loadPending, loadReports]);

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
    { id: "pending", label: "Pending tickets" },
    { id: "tickets", label: "Tickets" },
    { id: "sellers", label: "Sellers" },
    { id: "buyers", label: "Buyers" },
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
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">
                              {r.reporterEmail ?? r.reporterUsername ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{r.reason}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="max-h-24 min-w-[180px] max-w-[300px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded border border-army-purple/15 bg-neutral-50/80 px-2 py-1.5 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                                {r.details ?? "—"}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => setReportTicketOpen(r)}
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                >
                                  View ticket
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReportUserOpen({ userId: r.ownerId, email: r.ownerEmail, title: "Ticket owner" })}
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                >
                                  View owner
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReportUserOpen({ userId: r.reporterId, email: r.reporterEmail, title: "Reporter" })}
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                >
                                  View reporter
                                </button>
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

          {tab === "pending" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Pending tickets</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                New listings awaiting review. Pick one up to chat with the seller, then approve or reject.
              </p>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : pendingTickets.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No pending tickets.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Event</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">City · Day</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Price</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Owner</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Claimed by</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingTickets.map((t) => {
                          const isClaimedByMe = !!user && !!t.claimedBy && t.claimedBy === user.id;
                          return (
                            <tr
                              key={t.id}
                              className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                            >
                              <td className="px-4 py-3 font-medium text-army-purple dark:text-army-300">{t.event}</td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.city} · {t.day}</td>
                              <td className="px-4 py-3">{t.price > 0 ? formatPrice(t.price, t.currency ?? "USD") : "—"}</td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.ownerEmail ?? "—"}</td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.claimedByEmail ?? "—"}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {!t.claimedBy && user && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const { error: e } = await adminClaimTicket(t.id);
                                        if (e) setActionFeedback(`Error: ${e}`);
                                        else {
                                          setActionFeedback("Ticket claimed.");
                                          loadPending();
                                        }
                                      }}
                                      className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                    >
                                      Pick up
                                    </button>
                                  )}
                                  {t.ownerId && (
                                    <button
                                      type="button"
                                      onClick={() => openAdminChatByIdAndEmail(t.ownerId!, t.ownerEmail ?? "Owner")}
                                      className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                    >
                                      Chat
                                    </button>
                                  )}
                                  {isClaimedByMe && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const { error: e } = await adminApproveTicket(t.id);
                                          if (e) setActionFeedback(`Error: ${e}`);
                                          else {
                                            setActionFeedback("Ticket approved and listed.");
                                            loadPending();
                                            loadTicketsFiltered();
                                          }
                                        }}
                                        className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setRejectReasonOpen({ ticketId: t.id, ownerEmail: t.ownerEmail ?? null });
                                          setRejectReasonText("");
                                        }}
                                        className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Show
                </label>
                <select
                  value={ticketsFilter}
                  onChange={(e) => {
                    setTicketsFilter(e.target.value as typeof ticketsFilter);
                    setTicketsPage(0);
                  }}
                  className="input-army w-[320px]"
                >
                  <option value="available_approved">Available tickets (approved)</option>
                  <option value="available_unclaimed">Available tickets (not yet claimed)</option>
                  <option value="available_rejected">Available tickets (rejected)</option>
                  <option value="sold">Sold tickets</option>
                </select>
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
              ) : tickets.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-6 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
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
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Listing</th>
                            <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Claimed by</th>
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
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.status}</td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.listingStatus ?? "—"}</td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.claimedByEmail ?? "—"}</td>
                              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.ownerEmail ?? "—"}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setTicketDetailsOpen(t)}
                                    className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!confirm("Delete this ticket?")) return;
                                      handleDeleteTicket(t.id);
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
                                          loadTicketsFiltered();
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
                                          loadTicketsFiltered();
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

      {ticketDetailsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setTicketDetailsOpen(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-army-purple">Ticket details</h2>
            <div className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <p><span className="font-semibold">Event:</span> {ticketDetailsOpen.event}</p>
              <p><span className="font-semibold">City · Day:</span> {ticketDetailsOpen.city} · {ticketDetailsOpen.day}</p>
              <p><span className="font-semibold">Seat:</span> {ticketDetailsOpen.section} · {ticketDetailsOpen.row} · {ticketDetailsOpen.seat} · {ticketDetailsOpen.type}</p>
              <p><span className="font-semibold">Status:</span> {ticketDetailsOpen.status}</p>
              <p><span className="font-semibold">Listing:</span> {ticketDetailsOpen.listingStatus ?? "—"}</p>
              <p><span className="font-semibold">Owner:</span> {ticketDetailsOpen.ownerEmail ?? "—"}</p>
              <p><span className="font-semibold">Claimed by:</span> {ticketDetailsOpen.claimedByEmail ?? "—"}</p>
              <p><span className="font-semibold">Price:</span> {ticketDetailsOpen.price > 0 ? formatPrice(ticketDetailsOpen.price, ticketDetailsOpen.currency ?? "USD") : "—"}</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {ticketDetailsOpen.ownerId && (
                <button
                  type="button"
                  onClick={() => setReportUserOpen({ userId: ticketDetailsOpen.ownerId, email: ticketDetailsOpen.ownerEmail, title: "Ticket owner" })}
                  className="btn-army-outline rounded-lg px-3 py-2 text-sm"
                >
                  View user
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!confirm("Delete this ticket?")) return;
                  handleDeleteTicket(ticketDetailsOpen.id);
                  setTicketDetailsOpen(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete ticket
              </button>
              <button
                type="button"
                onClick={() => setTicketDetailsOpen(null)}
                className="btn-army rounded-lg px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {reportTicketOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setReportTicketOpen(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-army-purple">Ticket details (from report)</h2>
            <div className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <p><span className="font-semibold">Event:</span> {reportTicketOpen.ticketEvent}</p>
              <p><span className="font-semibold">City · Day:</span> {reportTicketOpen.ticketCity} · {reportTicketOpen.ticketDay}</p>
              <p><span className="font-semibold">Seat:</span> {reportTicketOpen.ticketSection} · {reportTicketOpen.ticketRow} · {reportTicketOpen.ticketSeat} · {reportTicketOpen.ticketType}</p>
              <p><span className="font-semibold">Qty:</span> {reportTicketOpen.ticketQuantity}</p>
              <p><span className="font-semibold">Ticket status:</span> {reportTicketOpen.ticketStatus}</p>
              <p><span className="font-semibold">Owner:</span> {reportTicketOpen.ownerEmail ?? "—"}</p>
              <p><span className="font-semibold">Price:</span> {reportTicketOpen.ticketPrice > 0 ? formatPrice(reportTicketOpen.ticketPrice, reportTicketOpen.ticketCurrency) : "—"}</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportUserOpen({ userId: reportTicketOpen.ownerId, email: reportTicketOpen.ownerEmail, title: "Ticket owner" })}
                className="btn-army-outline rounded-lg px-3 py-2 text-sm"
              >
                View user
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm("Delete this ticket?")) return;
                  handleDeleteTicket(reportTicketOpen.ticketId);
                  setReportTicketOpen(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete ticket
              </button>
              <button
                type="button"
                onClick={() => setReportTicketOpen(null)}
                className="btn-army rounded-lg px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {reportUserOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setReportUserOpen(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-army-purple">{reportUserOpen.title}</h2>
            <div className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <p><span className="font-semibold">Email:</span> {reportUserOpen.email ?? "—"}</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {reportUserOpen.userId && (
                <button
                  type="button"
                  onClick={() => {
                    openAdminChatByIdAndEmail(reportUserOpen.userId!, reportUserOpen.email ?? "User");
                    setReportUserOpen(null);
                  }}
                  className="btn-army-outline rounded-lg px-3 py-2 text-sm"
                >
                  Chat
                </button>
              )}
              {reportUserOpen.email && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Ban and delete ${reportUserOpen.email}?`)) return;
                    handleBanAndDelete(reportUserOpen.email!).then((ok) => {
                      if (ok) {
                        setActionFeedback(`Banned and deleted ${reportUserOpen.email}`);
                        loadSellers();
                        loadBuyers();
                        loadBanned();
                        loadReports();
                        loadTicketsFiltered();
                        loadPending();
                        setReportUserOpen(null);
                      }
                    });
                  }}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Ban & delete user
                </button>
              )}
              <button
                type="button"
                onClick={() => setReportUserOpen(null)}
                className="btn-army rounded-lg px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectReasonOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setRejectReasonOpen(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-army-purple">Reject ticket</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Add a reason. The seller will receive it as a notification.
            </p>
            <textarea
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value)}
              rows={4}
              className="input-army mt-4 w-full"
              placeholder="Reason for rejection…"
            />
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectReasonOpen(null)}
                className="btn-army-outline rounded-lg px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const reason = rejectReasonText.trim();
                  if (!reason) {
                    setActionFeedback("Error: rejection reason is required.");
                    return;
                  }
                  const { error: e } = await adminRejectTicket(rejectReasonOpen.ticketId, reason);
                  if (e) setActionFeedback(`Error: ${e}`);
                  else {
                    setActionFeedback("Ticket rejected.");
                    setRejectReasonOpen(null);
                    await Promise.all([loadPending(), loadTicketsFiltered()]);
                  }
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Reject ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
