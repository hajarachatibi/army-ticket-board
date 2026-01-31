"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatPrice } from "@/lib/data/currencies";
import { useAuth } from "@/lib/AuthContext";
import AdminChatModal from "@/components/AdminChatModal";
import {
  adminAddDynamicForumQuestion,
  adminDeleteForumQuestion,
  adminFetchAllForumQuestions,
  adminFetchForumSubmissions,
  adminSetForumQuestionActive,
  type ForumQuestion,
  type AdminForumSubmission,
} from "@/lib/supabase/forum";
import { adminDeleteStory, adminFetchPendingStories, adminModerateStory, type ArmyStory } from "@/lib/supabase/stories";
import { createAdminRecommendation, deleteAdminRecommendation, fetchAdminRecommendations, type AdminRecommendation } from "@/lib/supabase/recommendations";
import { adminFetchSellerProofApplications, adminSetSellerProofStatus, type SellerProofApplication } from "@/lib/supabase/sellerProof";
import { createSignedProofUrl } from "@/lib/supabase/signedProofUrl";
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
  fetchAdminAllUsersPage,
  fetchAdminDashboardStats,
  fetchAdminPendingTickets,
  fetchAdminReports,
  fetchAdminUserReports,
  fetchAdminSellersPage,
  fetchAdminTicketsFiltered,
  type AdminDashboardStats,
  type AdminPendingTicket,
  type AdminReport,
  type AdminUserReport,
  type AdminTicket,
  type AdminUser,
  type BannedUser,
} from "@/lib/supabase/admin";
import { adminGetOrCreateChat, type AdminChat } from "@/lib/supabase/adminChats";

type Tab =
  | "dashboard"
  | "ticketReports"
  | "userReports"
  | "pending"
  | "tickets"
  | "sellers"
  | "buyers"
  | "users"
  | "forum"
  | "forumSubmissions"
  | "stories"
  | "recommendations"
  | "sellerProof"
  | "banned";

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
  const [userReports, setUserReports] = useState<AdminUserReport[]>([]);
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
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [allUsersTotal, setAllUsersTotal] = useState(0);
  const [allUsersPage, setAllUsersPage] = useState(0);
  const [allUsersSearch, setAllUsersSearch] = useState("");
  const [allUsersSearchApplied, setAllUsersSearchApplied] = useState("");
  const [banned, setBanned] = useState<BannedUser[]>([]);
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats | null>(null);
  const [pendingTickets, setPendingTickets] = useState<AdminPendingTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [forumQuestions, setForumQuestions] = useState<ForumQuestion[]>([]);
  const [newForumPrompt, setNewForumPrompt] = useState("");
  const [forumSubmissions, setForumSubmissions] = useState<AdminForumSubmission[]>([]);

  const [pendingStories, setPendingStories] = useState<ArmyStory[]>([]);
  const [adminRecs, setAdminRecs] = useState<AdminRecommendation[]>([]);
  const [recTitle, setRecTitle] = useState("");
  const [recBody, setRecBody] = useState("");

  const [sellerProofApps, setSellerProofApps] = useState<SellerProofApplication[]>([]);
  const [proofImageUrls, setProofImageUrls] = useState<Record<string, string>>({});
  const [userReportProofUrls, setUserReportProofUrls] = useState<Record<string, string>>({});
  const [userReportProofOpen, setUserReportProofOpen] = useState<{ url: string; title: string } | null>(null);

  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [selectedAllUsers, setSelectedAllUsers] = useState<Set<string>>(new Set());

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

  const loadUserReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminUserReports();
    setLoading(false);
    if (e) setError(e);
    else if (data) {
      setUserReports(data);
      const entries: Array<[string, string]> = [];
      for (const r of data) {
        if (!r.imagePath) continue;
        const s = await createSignedProofUrl(r.imagePath);
        if ("url" in s) entries.push([r.id, s.url]);
      }
      setUserReportProofUrls(Object.fromEntries(entries));
    }
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

  const loadAllUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, total, error: e } = await fetchAdminAllUsersPage({ page: allUsersPage, search: allUsersSearchApplied });
    setLoading(false);
    if (e) setError(e);
    else {
      if (data) setAllUsers(data);
      setAllUsersTotal(total);
    }
  }, [allUsersPage, allUsersSearchApplied]);

  const loadBanned = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminBannedUsers();
    setLoading(false);
    if (e) setError(e);
    else if (data) setBanned(data);
  }, []);

  const loadForumQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await adminFetchAllForumQuestions();
    setLoading(false);
    if (e) setError(e);
    else if (data) setForumQuestions(data);
  }, []);

  const loadForumSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await adminFetchForumSubmissions();
    setLoading(false);
    if (e) setError(e);
    else setForumSubmissions(data);
  }, []);

  const loadPendingStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await adminFetchPendingStories();
    setLoading(false);
    if (e) setError(e);
    else setPendingStories(data);
  }, []);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminRecommendations();
    setLoading(false);
    if (e) setError(e);
    else setAdminRecs(data);
  }, []);

  const loadSellerProof = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await adminFetchSellerProofApplications();
    setLoading(false);
    if (e) setError(e);
    else {
      setSellerProofApps(data);
      // Best-effort signed URLs for admin view (private bucket).
      const entries: Array<[string, string]> = [];
      for (const a of data) {
        const r = await createSignedProofUrl(a.screenshotPath);
        if ("url" in r) entries.push([a.id, r.url]);
      }
      setProofImageUrls(Object.fromEntries(entries));
    }
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
    else if (tab === "ticketReports") loadReports();
    else if (tab === "userReports") loadUserReports();
    else if (tab === "pending") loadPending();
    else if (tab === "tickets") loadTicketsFiltered();
    else if (tab === "sellers") loadSellers();
    else if (tab === "buyers") loadBuyers();
    else if (tab === "users") loadAllUsers();
    else if (tab === "forum") loadForumQuestions();
    else if (tab === "forumSubmissions") loadForumSubmissions();
    else if (tab === "stories") loadPendingStories();
    else if (tab === "recommendations") loadRecommendations();
    else if (tab === "sellerProof") loadSellerProof();
    else if (tab === "banned") loadBanned();
  }, [user?.id, isAdmin, tab, loadDashboardStats, loadReports, loadUserReports, loadPending, loadTicketsFiltered, loadSellers, loadBuyers, loadAllUsers, loadForumQuestions, loadForumSubmissions, loadPendingStories, loadRecommendations, loadSellerProof, loadBanned]);

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
    if (tab === "users") loadAllUsers();
  }, [allUsersPage, allUsersSearchApplied, tab, loadAllUsers]);

  useEffect(() => {
    setSelectedAllUsers(new Set());
  }, [allUsersPage]);

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

  const handleAddForumQuestion = useCallback(async () => {
    const prompt = newForumPrompt.trim();
    if (!prompt) return;
    setLoading(true);
    setError(null);
    const { error: e } = await adminAddDynamicForumQuestion({ prompt });
    setLoading(false);
    if (e) {
      setError(e);
      return;
    }
    setNewForumPrompt("");
    setActionFeedback("Forum question added.");
    loadForumQuestions();
  }, [newForumPrompt, loadForumQuestions]);

  const handleToggleForumQuestion = useCallback(
    async (id: string, active: boolean) => {
      setLoading(true);
      setError(null);
      const { error: e } = await adminSetForumQuestionActive({ id, active });
      setLoading(false);
      if (e) setError(e);
      else {
        setActionFeedback(active ? "Question activated." : "Question deactivated.");
        loadForumQuestions();
      }
    },
    [loadForumQuestions]
  );

  const handleDeleteForumQuestion = useCallback(
    async (id: string) => {
      if (!confirm("Delete this question?")) return;
      setLoading(true);
      setError(null);
      const { error: e } = await adminDeleteForumQuestion({ id });
      setLoading(false);
      if (e) setError(e);
      else {
        setActionFeedback("Question deleted.");
        loadForumQuestions();
      }
    },
    [loadForumQuestions]
  );

  const handleModerateStory = useCallback(
    async (id: string, status: "approved" | "rejected") => {
      setLoading(true);
      setError(null);
      const { error: e } = await adminModerateStory({ id, status });
      setLoading(false);
      if (e) setError(e);
      else {
        setActionFeedback(`Story ${status}.`);
        loadPendingStories();
      }
    },
    [loadPendingStories]
  );

  const handleDeleteStory = useCallback(
    async (id: string) => {
      if (!confirm("Delete this story?")) return;
      setLoading(true);
      setError(null);
      const { error: e } = await adminDeleteStory(id);
      setLoading(false);
      if (e) setError(e);
      else {
        setActionFeedback("Story deleted.");
        loadPendingStories();
      }
    },
    [loadPendingStories]
  );

  const handleCreateRec = useCallback(async () => {
    if (!user?.id) return;
    const t = recTitle.trim();
    const b = recBody.trim();
    if (!t || !b) return;
    setLoading(true);
    setError(null);
    const { error: e } = await createAdminRecommendation({ authorId: user.id, title: t, body: b });
    setLoading(false);
    if (e) setError(e);
    else {
      setRecTitle("");
      setRecBody("");
      setActionFeedback("Recommendation added.");
      loadRecommendations();
    }
  }, [user?.id, recTitle, recBody, loadRecommendations]);

  const handleDeleteRec = useCallback(
    async (id: string) => {
      if (!confirm("Delete this recommendation?")) return;
      setLoading(true);
      setError(null);
      const { error: e } = await deleteAdminRecommendation(id);
      setLoading(false);
      if (e) setError(e);
      else {
        setActionFeedback("Recommendation deleted.");
        loadRecommendations();
      }
    },
    [loadRecommendations]
  );

  const handleSellerProofDecision = useCallback(
    async (id: string, status: "approved" | "rejected") => {
      setLoading(true);
      setError(null);
      const { error: e } = await adminSetSellerProofStatus({ id, status });
      setLoading(false);
      if (e) setError(e);
      else {
        setActionFeedback(`Seller proof ${status}.`);
        loadSellerProof();
      }
    },
    [loadSellerProof]
  );

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
      setSelectedAllUsers(new Set());
      loadSellers();
      loadBuyers();
      loadAllUsers();
      loadBanned();
      loadReports();
      loadTicketsFiltered();
    },
    [handleBanAndDelete, loadSellers, loadBuyers, loadAllUsers, loadBanned, loadReports, loadTicketsFiltered]
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

  const toggleAllUser = useCallback((id: string) => {
    setSelectedAllUsers((s) => {
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
    { id: "ticketReports", label: "Ticket reports" },
    { id: "userReports", label: "User reports" },
    { id: "pending", label: "Pending tickets" },
    { id: "tickets", label: "Tickets" },
    { id: "sellers", label: "Sellers" },
    { id: "buyers", label: "Buyers" },
    { id: "users", label: "All users" },
    { id: "forum", label: "Forum questions" },
    { id: "forumSubmissions", label: "Forum submissions" },
    { id: "stories", label: "ARMY Stories" },
    { id: "recommendations", label: "Recommendations" },
    { id: "sellerProof", label: "Seller proof" },
    { id: "banned", label: "Banned users" },
  ];

  const selectedSellerUsers = sellers.filter((u) => selectedSellers.has(u.id));
  const selectedBuyerUsers = buyers.filter((u) => selectedBuyers.has(u.id));
  const selectedAllUserUsers = allUsers.filter((u) => selectedAllUsers.has(u.id));

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

          {tab === "ticketReports" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Ticket reports</h2>
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

          {tab === "userReports" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">User reports</h2>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : userReports.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No user reports.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                          <th className="whitespace-nowrap px-4 py-3 font-semibold text-army-purple dark:text-army-300">Date</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Reporter</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Reported user</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Reason</th>
                          <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Details</th>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold text-army-purple dark:text-army-300">Proof</th>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userReports.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">
                              {formatDate(r.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                              {r.reporterEmail ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                              {r.reportedEmail ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{r.reason}</td>
                            <td className="max-w-[420px] px-4 py-3 text-neutral-600 dark:text-neutral-400">
                              <div className="max-h-20 overflow-auto whitespace-pre-wrap">
                                {r.details ?? "—"}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {userReportProofUrls[r.id] ? (
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  onClick={() =>
                                    setUserReportProofOpen({
                                      url: userReportProofUrls[r.id]!,
                                      title: `Proof image (${r.reason})`,
                                    })
                                  }
                                >
                                  View proof
                                </button>
                              ) : (
                                <span className="text-xs text-neutral-500 dark:text-neutral-400">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReportUserOpen({
                                      userId: r.reportedUserId,
                                      email: r.reportedEmail,
                                      title: "Reported user",
                                    })
                                  }
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                >
                                  View user
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReportUserOpen({
                                      userId: r.reporterId,
                                      email: r.reporterEmail,
                                      title: "Reporter",
                                    })
                                  }
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                >
                                  View reporter
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
                                  <button
                                    type="button"
                                    onClick={() => setTicketDetailsOpen(t)}
                                    className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  >
                                    View
                                  </button>
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

          {tab === "users" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">All users</h2>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={allUsersSearch}
                  onChange={(e) => setAllUsersSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setAllUsersSearchApplied((e.target as HTMLInputElement).value);
                      setAllUsersPage(0);
                    }
                  }}
                  placeholder="Search by name or email…"
                  className="input-army w-64"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAllUsersSearchApplied(allUsersSearch);
                    setAllUsersPage(0);
                  }}
                  className="btn-army rounded-lg px-4 py-2 text-sm"
                >
                  Search
                </button>
              </div>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : allUsers.length === 0 && allUsersTotal === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No users.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
                    Page {allUsersPage + 1} · {allUsersTotal} total
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={selectedAllUserUsers.length === 0}
                      onClick={() => {
                        if (confirm(`Ban and delete data for ${selectedAllUserUsers.length} selected user(s)?`)) {
                          handleBanAndDeleteMultiple(selectedAllUserUsers);
                        }
                      }}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Ban & delete selected ({selectedAllUsers.size})
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
                                checked={allUsers.length > 0 && selectedAllUsers.size === allUsers.length}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedAllUsers(new Set(allUsers.map((u) => u.id)));
                                  else setSelectedAllUsers(new Set());
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
                          {allUsers.map((u) => (
                            <tr
                              key={u.id}
                              className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedAllUsers.has(u.id)}
                                  onChange={() => toggleAllUser(u.id)}
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
                                          loadAllUsers();
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
                      disabled={allUsersPage === 0}
                      onClick={() => setAllUsersPage((p) => Math.max(0, p - 1))}
                      className="btn-army-outline rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={(allUsersPage + 1) * 24 >= allUsersTotal}
                      onClick={() => setAllUsersPage((p) => p + 1)}
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

          {tab === "forum" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Forum questions</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                Static questions are seeded and should usually stay. Dynamic questions can be added/disabled any time.
                When questions change, users will be asked to re-submit the forum.
              </p>

              <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                <label className="block text-sm font-semibold text-army-purple">Add a new dynamic question</label>
                <textarea
                  value={newForumPrompt}
                  onChange={(e) => setNewForumPrompt(e.target.value)}
                  rows={3}
                  className="input-army mt-2 resize-none"
                  placeholder="Type the question…"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="btn-army"
                    onClick={handleAddForumQuestion}
                    disabled={loading || !newForumPrompt.trim()}
                  >
                    Add question
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Type</th>
                        <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Active</th>
                        <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Question</th>
                        <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td className="px-4 py-6 text-neutral-500" colSpan={4}>
                            Loading…
                          </td>
                        </tr>
                      ) : forumQuestions.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-neutral-500" colSpan={4}>
                            No questions found.
                          </td>
                        </tr>
                      ) : (
                        forumQuestions.map((q) => (
                          <tr
                            key={q.id}
                            className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                          >
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                              {q.kind === "static" ? "Static" : "Dynamic"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  q.active
                                    ? "bg-army-200/50 text-army-800 dark:bg-army-300/30 dark:text-army-200"
                                    : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
                                }`}
                              >
                                {q.active ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{q.prompt}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleForumQuestion(q.id, !q.active)}
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                >
                                  {q.active ? "Deactivate" : "Activate"}
                                </button>
                                {q.kind === "dynamic" && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteForumQuestion(q.id)}
                                    className="rounded bg-red-500/15 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-500/25 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {tab === "forumSubmissions" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Forum submissions</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                Latest BTS answers per user (manual review). If answers look suspicious, you can ban the user from the user popup.
              </p>

              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : forumSubmissions.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No submissions yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {forumSubmissions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-army-purple">
                            {s.userEmail ?? s.username ?? s.userId}
                          </p>
                          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{formatDate(s.submittedAt)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReportUserOpen({ userId: s.userId, email: s.userEmail ?? null, title: "Forum submission user" })}
                          className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                        >
                          View user
                        </button>
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                        {Object.entries(s.answers ?? {}).length === 0 ? (
                          <p className="text-neutral-500 dark:text-neutral-400">No answers.</p>
                        ) : (
                          Object.entries(s.answers).map(([qid, ans]) => (
                            <div key={qid} className="rounded-xl border border-army-purple/10 bg-army-purple/5 p-3 dark:border-army-purple/20 dark:bg-army-purple/10">
                              <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">QID {qid}</p>
                              <p className="mt-1 whitespace-pre-wrap break-words">{String(ans ?? "")}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "stories" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">ARMY Stories moderation</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                Stories are submitted as <span className="font-semibold">pending</span>. Approve to publish on `/stories`.
              </p>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : pendingStories.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No pending stories.
                </p>
              ) : (
                <div className="space-y-4">
                  {pendingStories.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">{s.status}</p>
                          <h3 className="mt-1 font-display text-lg font-bold text-army-purple">{s.title}</h3>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {s.anonymous ? "Anonymous" : s.authorUsername} · {formatDate(s.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {s.status !== "approved" && (
                            <button
                              type="button"
                              onClick={() => handleModerateStory(s.id, "approved")}
                              className="rounded bg-army-purple px-3 py-2 text-sm font-semibold text-white hover:bg-army-700"
                            >
                              Approve
                            </button>
                          )}
                          {s.status !== "rejected" && (
                            <button
                              type="button"
                              onClick={() => handleModerateStory(s.id, "rejected")}
                              className="rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteStory(s.id)}
                            className="rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">
                        {s.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "recommendations" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">ARMY Recommendations (admin-only)</h2>
              <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                <p className="text-sm font-semibold text-army-purple">Add recommendation</p>
                <input
                  className="input-army mt-2"
                  placeholder="Title"
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                />
                <textarea
                  className="input-army mt-2 resize-none"
                  rows={4}
                  placeholder="Write recommendation…"
                  value={recBody}
                  onChange={(e) => setRecBody(e.target.value)}
                />
                <div className="mt-3 flex justify-end">
                  <button type="button" className="btn-army" onClick={handleCreateRec} disabled={loading || !recTitle.trim() || !recBody.trim()}>
                    Add
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="text-neutral-500">Loading…</p>
                ) : adminRecs.length === 0 ? (
                  <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                    No recommendations yet.
                  </p>
                ) : (
                  adminRecs.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-army-purple/15 bg-white p-5 dark:border-army-purple/25 dark:bg-neutral-900">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-display text-lg font-bold text-army-purple">{r.title}</h3>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{formatDate(r.createdAt)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteRec(r.id)}
                          className="rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">{r.body}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {tab === "sellerProof" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Seller proof applications</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                Review seller proof submissions before approving new ticket listings.
              </p>

              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : sellerProofApps.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No applications yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {sellerProofApps.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">{a.status}</p>
                          <p className="mt-1 text-sm font-semibold text-army-purple">{a.fullName}</p>
                          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                            {a.country} · {a.platform} · {formatDate(a.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSellerProofDecision(a.id, "approved")}
                            className="rounded bg-army-purple px-3 py-2 text-sm font-semibold text-white hover:bg-army-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSellerProofDecision(a.id, "rejected")}
                            className="rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                          >
                            Reject
                          </button>
                        </div>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">
                        {a.proofDetails}
                      </p>

                      <div className="mt-3 overflow-hidden rounded-2xl border border-army-purple/15 dark:border-army-purple/25">
                        {proofImageUrls[a.id] ? (
                          <img src={proofImageUrls[a.id]} alt="Seller proof screenshot" className="h-auto w-full" />
                        ) : (
                          <div className="px-4 py-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
                            Unable to load proof image (signed URL).
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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

      {userReportProofOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="User report proof"
          onClick={() => setUserReportProofOpen(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-army-purple/20 bg-white shadow-2xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-army-purple/10 px-4 py-3 dark:border-army-purple/20">
              <p className="text-sm font-semibold text-army-purple">{userReportProofOpen.title}</p>
              <button type="button" className="btn-army-outline rounded-lg px-3 py-2 text-sm" onClick={() => setUserReportProofOpen(null)}>
                Close
              </button>
            </div>
            <div className="bg-black/5 p-3 dark:bg-black/20">
              <img src={userReportProofOpen.url} alt="Proof" className="h-auto w-full rounded-xl" />
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
