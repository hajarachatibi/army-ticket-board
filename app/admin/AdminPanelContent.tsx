"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AdminListingModal from "@/components/AdminListingModal";
import LiteProfileModal from "@/components/LiteProfileModal";
import { useAuth } from "@/lib/AuthContext";
import { formatPrice } from "@/lib/data/currencies";
import { deleteAdminRecommendation, fetchAdminRecommendations, type AdminRecommendation } from "@/lib/supabase/recommendations";
import {
  addUserQuestionReply,
  deleteUserQuestion,
  fetchUnansweredUserQuestions,
  type UserQuestion,
} from "@/lib/supabase/userQuestions";
import { createSignedProofUrl } from "@/lib/supabase/signedProofUrl";
import {
  addStoryReplyAdmin,
  adminDeleteStory,
  adminFetchApprovedStories,
  adminFetchPendingStories,
  adminModerateStory,
  type ArmyStory,
} from "@/lib/supabase/stories";
import { supabase } from "@/lib/supabaseClient";
import {
  adminBanAndDeleteUser,
  adminDeleteListingReport,
  adminReleaseUserListings,
  adminRemoveListing,
  adminUnbanUser,
  fetchAdminAllUsersPage,
  fetchAdminBannedUsers,
  fetchAdminBuyersPage,
  fetchAdminDashboardStats,
  fetchAdminListingReports,
  fetchAdminListingsFiltered,
  fetchAdminSellersPage,
  fetchAdminUserReports,
  fetchAdminUsersUnderReview,
  fetchConnectionStats,
  type AdminDashboardStats,
  type AdminListing,
  type AdminListingReport,
  type AdminUser,
  type AdminUserReport,
  type AdminUserUnderReview,
  type BannedUser,
  type ConnectionStats,
} from "@/lib/supabase/admin";

type Tab =
  | "dashboard"
  | "listingReports"
  | "userReports"
  | "usersUnderReview"
  | "listings"
  | "armyProfileQuestions"
  | "bondingQuestions"
  | "stories"
  | "recommendations"
  | "unansweredQuestions"
  | "sellers"
  | "buyers"
  | "users"
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);

  const [listingReports, setListingReports] = useState<AdminListingReport[]>([]);
  const [userReports, setUserReports] = useState<AdminUserReport[]>([]);
  const [userReportProofUrls, setUserReportProofUrls] = useState<Record<string, string>>({});
  const [userReportProofOpen, setUserReportProofOpen] = useState<{ url: string; title: string } | null>(null);

  const [listings, setListings] = useState<AdminListing[]>([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [listingsPage, setListingsPage] = useState(0);
  const [listingsSearch, setListingsSearch] = useState("");
  const [listingsSearchApplied, setListingsSearchApplied] = useState("");
  const [listingsStatus, setListingsStatus] = useState("");

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
  const [usersUnderReview, setUsersUnderReview] = useState<AdminUserUnderReview[]>([]);

  const [profileOpen, setProfileOpen] = useState<{ userId: string; title: string } | null>(null);
  const [listingOpen, setListingOpen] = useState<{ listingId: string } | null>(null);
  const [removeListingModal, setRemoveListingModal] = useState<{ listingId: string } | null>(null);
  const [removeListingMessage, setRemoveListingMessage] = useState("");

  const [stories, setStories] = useState<ArmyStory[]>([]);
  const [storyReplyDrafts, setStoryReplyDrafts] = useState<Record<string, string>>({});
  const [approvedStories, setApprovedStories] = useState<ArmyStory[]>([]);
  const [storyReplyEdit, setStoryReplyEdit] = useState<{ id: string; title: string; reply: string } | null>(null); // modal for adding admin reply
  const [recommendations, setRecommendations] = useState<AdminRecommendation[]>([]);
  const [unansweredQuestions, setUnansweredQuestions] = useState<UserQuestion[]>([]);
  const [questionReplyModal, setQuestionReplyModal] = useState<{ questionId: string; text: string } | null>(null);
  const [questionReplyDraft, setQuestionReplyDraft] = useState("");
  const [questionReplySaving, setQuestionReplySaving] = useState(false);

  const [armyProfileQuestions, setArmyProfileQuestions] = useState<
    Array<{ key: string; prompt: string; active: boolean; position: number }>
  >([]);
  const [newArmyProfileKey, setNewArmyProfileKey] = useState("");
  const [newArmyProfilePrompt, setNewArmyProfilePrompt] = useState("");
  const [newArmyProfilePosition, setNewArmyProfilePosition] = useState("100");
  const [newArmyProfileActive, setNewArmyProfileActive] = useState(true);

  const [bondingQuestions, setBondingQuestions] = useState<Array<{ id: string; prompt: string; active: boolean; createdAt: string }>>([]);
  const [newBondingPrompt, setNewBondingPrompt] = useState("");

  const TABS: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: "dashboard", label: "Dashboard" },
      { id: "listingReports", label: "Listing reports" },
      { id: "userReports", label: "User reports" },
      { id: "usersUnderReview", label: "Users under review" },
      { id: "listings", label: "Listings" },
      { id: "armyProfileQuestions", label: "ARMY Profile Questions" },
      { id: "bondingQuestions", label: "Connection bonding questions" },
      { id: "stories", label: "ARMY Stories & Feedback" },
      { id: "recommendations", label: "Recommendations" },
      { id: "unansweredQuestions", label: "Unanswered questions" },
      { id: "sellers", label: "Sellers" },
      { id: "buyers", label: "Buyers" },
      { id: "users", label: "All users" },
      { id: "banned", label: "Banned users" },
    ],
    []
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) router.replace("/");
  }, [authLoading, isAdmin, router, user]);

  const loadDashboard = useCallback(async () => {
    const [statsRes, connRes] = await Promise.all([fetchAdminDashboardStats(), fetchConnectionStats()]);
    if (statsRes.error) setError(statsRes.error);
    else setDashboardStats(statsRes.data);
    if (connRes.error) setError(connRes.error);
    else setConnectionStats(connRes.data);
  }, []);

  const loadListingReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminListingReports();
    setLoading(false);
    if (e) setError(e);
    else setListingReports(data);
  }, []);

  const loadUserReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminUserReports();
    setLoading(false);
    if (e) setError(e);
    else {
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

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, total, error: e } = await fetchAdminListingsFiltered({
      page: listingsPage,
      search: listingsSearchApplied,
      status: listingsStatus,
    });
    setLoading(false);
    if (e) setError(e);
    else {
      setListings(data);
      setListingsTotal(total);
    }
  }, [listingsPage, listingsSearchApplied, listingsStatus]);

  const loadSellers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, total, error: e } = await fetchAdminSellersPage({ page: sellersPage, search: sellersSearchApplied });
    setLoading(false);
    if (e) setError(e);
    else {
      setSellers(data);
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
      setBuyers(data);
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
      setAllUsers(data);
      setAllUsersTotal(total);
    }
  }, [allUsersPage, allUsersSearchApplied]);

  const loadBanned = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminBannedUsers();
    setLoading(false);
    if (e) setError(e);
    else setBanned(data);
  }, []);

  const loadUsersUnderReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminUsersUnderReview();
    setLoading(false);
    if (e) setError(e);
    else setUsersUnderReview(data);
  }, []);

  const loadStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [pendingRes, approvedRes] = await Promise.all([
      adminFetchPendingStories(),
      adminFetchApprovedStories(),
    ]);
    setLoading(false);
    if (pendingRes.error) setError(pendingRes.error);
    else setStories(pendingRes.data);
    if (approvedRes.error) setError(approvedRes.error);
    else setApprovedStories(approvedRes.data);
  }, []);

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminRecommendations();
    setLoading(false);
    if (e) setError(e);
    else setRecommendations(data);
  }, []);

  const loadUnansweredQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchUnansweredUserQuestions({ limit: 100, offset: 0 });
    setLoading(false);
    if (e) setError(e);
    else setUnansweredQuestions(data ?? []);
  }, []);

  const loadArmyProfileQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("army_profile_questions")
      .select("key, prompt, active, position")
      .order("position", { ascending: true });
    setLoading(false);
    if (e) setError(e.message);
    else setArmyProfileQuestions((data ?? []) as any);
  }, []);

  const loadBondingQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("bonding_questions")
      .select("id, prompt, active, created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (e) setError(e.message);
    else {
      const rows = ((data ?? []) as Array<{ id: string; prompt: string; active: boolean; created_at: string }>).map((r) => ({
        id: String(r.id),
        prompt: String(r.prompt ?? ""),
        active: Boolean(r.active),
        createdAt: String((r as any).created_at ?? ""),
      }));
      setBondingQuestions(rows);
    }
  }, []);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    if (tab === "dashboard") void loadDashboard();
    if (tab === "listingReports") void loadListingReports();
    if (tab === "userReports") void loadUserReports();
    if (tab === "listings") void loadListings();
    if (tab === "armyProfileQuestions") void loadArmyProfileQuestions();
    if (tab === "bondingQuestions") void loadBondingQuestions();
    if (tab === "stories") void loadStories();
    if (tab === "recommendations") void loadRecommendations();
    if (tab === "unansweredQuestions") void loadUnansweredQuestions();
    if (tab === "sellers") void loadSellers();
    if (tab === "buyers") void loadBuyers();
    if (tab === "users") void loadAllUsers();
    if (tab === "banned") void loadBanned();
  }, [
    isAdmin,
    tab,
    user?.id,
    loadAllUsers,
    loadArmyProfileQuestions,
    loadBondingQuestions,
    loadBanned,
    loadBuyers,
    loadDashboard,
    loadListingReports,
    loadListings,
    loadRecommendations,
    loadUnansweredQuestions,
    loadSellers,
    loadStories,
    loadUserReports,
    loadUsersUnderReview,
  ]);

  useEffect(() => {
    if (tab === "listings") void loadListings();
  }, [listingsPage, listingsSearchApplied, listingsStatus, tab, loadListings]);

  useEffect(() => {
    if (tab === "sellers") void loadSellers();
  }, [sellersPage, sellersSearchApplied, tab, loadSellers]);

  useEffect(() => {
    if (tab === "buyers") void loadBuyers();
  }, [buyersPage, buyersSearchApplied, tab, loadBuyers]);

  useEffect(() => {
    if (tab === "users") void loadAllUsers();
  }, [allUsersPage, allUsersSearchApplied, tab, loadAllUsers]);

  const openUserProfile = useCallback((params: { userId: string; title: string }) => {
    setProfileOpen(params);
  }, []);

  const openListing = useCallback((listingId: string) => {
    setListingOpen({ listingId });
  }, []);

  const banAndDelete = useCallback(async (email: string) => {
    if (!confirm(`Ban and delete user "${email}"?`)) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await adminBanAndDeleteUser(email);
      if (e) setFeedback(`Error: ${e}`);
      else setFeedback("User banned and deleted.");
      await Promise.all([loadDashboard(), loadBanned(), loadSellers(), loadBuyers(), loadAllUsers(), loadUsersUnderReview()]);
    } finally {
      setLoading(false);
    }
  }, [loadAllUsers, loadBanned, loadBuyers, loadDashboard, loadSellers, loadUsersUnderReview]);

  const releaseUserListings = useCallback(
    async (userId: string) => {
      if (!confirm("Release this user's listings? They will be visible in browse again.")) return;
      setLoading(true);
      setError(null);
      try {
        const { error: e } = await adminReleaseUserListings(userId);
        if (e) setFeedback(`Error: ${e}`);
        else setFeedback("Listings released.");
        await Promise.all([loadUsersUnderReview(), loadDashboard()]);
      } finally {
        setLoading(false);
      }
    },
    [loadDashboard, loadUsersUnderReview]
  );

  const unban = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await adminUnbanUser(email);
      if (e) setFeedback(`Error: ${e}`);
      else setFeedback("User unbanned.");
      await loadBanned();
    } finally {
      setLoading(false);
    }
  }, [loadBanned]);

  const deleteListingReport = useCallback(async (reportId: string) => {
    if (!confirm("Delete this report?")) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await adminDeleteListingReport(reportId);
      if (e) setFeedback(`Error: ${e}`);
      else {
        setFeedback("Report deleted.");
        setListingReports((prev) => prev.filter((r) => r.id !== reportId));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const openRemoveListingModal = useCallback((listingId: string) => {
    setRemoveListingModal({ listingId });
    setRemoveListingMessage("");
  }, []);

  const removeListing = useCallback(
    async (listingId: string, adminMessage?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const { error: e } = await adminRemoveListing(listingId, adminMessage);
        if (e) setFeedback(`Error: ${e}`);
        else setFeedback("Listing removed.");
        setRemoveListingModal(null);
        setRemoveListingMessage("");
        await Promise.all([loadListings(), loadListingReports(), loadDashboard()]);
      } finally {
        setLoading(false);
      }
    },
    [loadDashboard, loadListingReports, loadListings]
  );

  const confirmRemoveListing = useCallback(() => {
    if (!removeListingModal) return;
    const msg = removeListingMessage.trim() || undefined;
    void removeListing(removeListingModal.listingId, msg);
  }, [removeListingModal, removeListingMessage, removeListing]);

  const saveArmyProfileQuestion = useCallback(async (q: { key: string; prompt: string; active: boolean; position: number }) => {
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await supabase.from("army_profile_questions").update({ prompt: q.prompt, active: q.active, position: q.position }).eq("key", q.key);
      if (e) setFeedback(`Error: ${e.message}`);
      else setFeedback("Saved.");
      await loadArmyProfileQuestions();
    } finally {
      setLoading(false);
    }
  }, [loadArmyProfileQuestions]);

  const addArmyProfileQuestion = useCallback(async () => {
    const key = newArmyProfileKey.trim();
    const prompt = newArmyProfilePrompt.trim();
    const position = Number(newArmyProfilePosition) || 0;
    if (!key || !prompt) return;
    if (!/^[a-z0-9_]+$/.test(key)) {
      setFeedback("Error: key must be lowercase letters/numbers/underscore only.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await supabase.from("army_profile_questions").insert({
        key,
        prompt,
        active: newArmyProfileActive,
        position,
      });
      if (e) setFeedback(`Error: ${e.message}`);
      else {
        setFeedback("Question added.");
        setNewArmyProfileKey("");
        setNewArmyProfilePrompt("");
        setNewArmyProfilePosition(String(Math.max(1, position + 1)));
        setNewArmyProfileActive(true);
      }
      await loadArmyProfileQuestions();
    } finally {
      setLoading(false);
    }
  }, [loadArmyProfileQuestions, newArmyProfileActive, newArmyProfileKey, newArmyProfilePosition, newArmyProfilePrompt]);

  const deleteArmyProfileQuestion = useCallback(async (key: string) => {
    if (!confirm(`Delete ARMY profile question "${key}"?`)) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await supabase.from("army_profile_questions").delete().eq("key", key);
      if (e) setFeedback(`Error: ${e.message}`);
      else setFeedback("Deleted.");
      await loadArmyProfileQuestions();
    } finally {
      setLoading(false);
    }
  }, [loadArmyProfileQuestions]);

  const moderateStory = useCallback(
    async (id: string, status: "approved" | "rejected", adminReply?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const { error: e } = await adminModerateStory({ id, status, adminReply });
        if (e) setFeedback(`Error: ${e}`);
        else setFeedback(`Story ${status}.`);
        setStoryReplyDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        await loadStories();
      } finally {
        setLoading(false);
      }
    },
    [loadStories]
  );

  const saveStoryReply = useCallback(async (id: string, reply: string) => {
    const body = reply.trim();
    if (!body) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await addStoryReplyAdmin(id, body);
      if (e) setFeedback(`Error: ${e}`);
      else setFeedback("Reply added.");
      setStoryReplyEdit(null);
      await loadStories();
    } finally {
      setLoading(false);
    }
  }, [loadStories]);

  const removeStory = useCallback(async (id: string) => {
    if (!confirm("Delete this story?")) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await adminDeleteStory(id);
      if (e) setFeedback(`Error: ${e}`);
      else setFeedback("Story deleted.");
      await loadStories();
    } finally {
      setLoading(false);
    }
  }, [loadStories]);

  const removeRecommendation = useCallback(async (id: string) => {
    if (!confirm("Delete this recommendation?")) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await deleteAdminRecommendation(id);
      if (e) setFeedback(`Error: ${e}`);
      else setFeedback("Recommendation deleted.");
      await loadRecommendations();
    } finally {
      setLoading(false);
    }
  }, [loadRecommendations]);

  const removeQuestion = useCallback(async (questionId: string) => {
    if (!confirm("Remove this question? Replies will be deleted too.")) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await deleteUserQuestion(questionId);
      if (e) setFeedback(`Error: ${e}`);
      else setFeedback("Question removed.");
      await loadUnansweredQuestions();
    } finally {
      setLoading(false);
    }
  }, [loadUnansweredQuestions]);

  const submitQuestionReply = useCallback(async () => {
    if (!user || !questionReplyModal || !questionReplyDraft.trim()) return;
    setQuestionReplySaving(true);
    setError(null);
    try {
      const { error: e } = await addUserQuestionReply({
        questionId: questionReplyModal.questionId,
        userId: user.id,
        text: questionReplyDraft.trim(),
      });
      if (e) setFeedback(`Error: ${e}`);
      else {
        setFeedback("Reply posted.");
        setQuestionReplyModal(null);
        setQuestionReplyDraft("");
        await loadUnansweredQuestions();
      }
    } finally {
      setQuestionReplySaving(false);
    }
  }, [user, questionReplyModal, questionReplyDraft, loadUnansweredQuestions]);

  const addBondingQuestion = useCallback(async () => {
    const prompt = newBondingPrompt.trim();
    if (!prompt) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await supabase.from("bonding_questions").insert({ prompt, active: true });
      if (e) setFeedback(`Error: ${e.message}`);
      else setFeedback("Bonding question added.");
      setNewBondingPrompt("");
      await loadBondingQuestions();
    } finally {
      setLoading(false);
    }
  }, [loadBondingQuestions, newBondingPrompt]);

  const saveBondingQuestion = useCallback(async (q: { id: string; prompt: string; active: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await supabase.from("bonding_questions").update({ prompt: q.prompt, active: q.active }).eq("id", q.id);
      if (e) setFeedback(`Error: ${e.message}`);
      else setFeedback("Saved.");
      await loadBondingQuestions();
    } finally {
      setLoading(false);
    }
  }, [loadBondingQuestions]);

  const deleteBondingQuestion = useCallback(async (id: string) => {
    if (!confirm("Delete this bonding question?")) return;
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await supabase.from("bonding_questions").delete().eq("id", id);
      if (e) setFeedback(`Error: ${e.message}`);
      else setFeedback("Deleted.");
      await loadBondingQuestions();
    } finally {
      setLoading(false);
    }
  }, [loadBondingQuestions]);

  if (authLoading || !user || !isAdmin) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-center text-army-purple">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-army-subtle">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold text-army-purple">Admin</h1>
          <Link href="/tickets" className="btn-army-outline text-sm">
            Back to Listings
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert">
            {error}
          </div>
        )}
        {feedback && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-army-purple/20 bg-army-purple/5 px-4 py-2 text-sm text-army-purple dark:bg-army-purple/10" role="status">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback(null)} className="text-army-purple/80 hover:underline">
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
                    <p className="text-sm font-medium text-army-purple dark:text-army-300">Listings</p>
                    <p className="mt-1 text-2xl font-bold text-neutral-800 dark:text-neutral-200">{dashboardStats.listings}</p>
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

              {connectionStats !== null && (
                <div className="mt-8">
                  <h3 className="mb-3 font-display text-lg font-semibold text-army-purple dark:text-army-300">Connections</h3>
                  <div className="mb-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                      <p className="text-sm font-medium text-army-purple dark:text-army-300">Active connections</p>
                      <p className="mt-1 text-2xl font-bold text-neutral-800 dark:text-neutral-200">{connectionStats.activeConnections}</p>
                    </div>
                    <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                      <p className="text-sm font-medium text-army-purple dark:text-army-300">Waiting list (pending_seller)</p>
                      <p className="mt-1 text-2xl font-bold text-neutral-800 dark:text-neutral-200">{connectionStats.waitingListCount}</p>
                    </div>
                  </div>
                  {(Object.keys(connectionStats.byStage).length > 0 || connectionStats.activeConnections !== undefined) && (
                    <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                      <p className="border-b border-army-purple/15 px-4 py-2 text-sm font-semibold text-army-purple dark:border-army-purple/25 dark:text-army-300">Count by stage</p>
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                          <tr>
                            <th className="px-4 py-2 font-semibold text-army-purple dark:text-army-300">Stage</th>
                            <th className="px-4 py-2 font-semibold text-army-purple dark:text-army-300">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            [
                              "pending_seller",
                              "declined",
                              "bonding",
                              "preview",
                              "comfort",
                              "social",
                              "agreement",
                              "chat_open",
                              "ended",
                              "expired",
                            ] as const
                          ).map((stage) => (
                            <tr key={stage} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                              <td className="px-4 py-2 font-medium text-neutral-800 dark:text-neutral-200">{stage}</td>
                              <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{connectionStats.byStage[stage] ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === "listingReports" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Listing reports</h2>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : listingReports.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No listing reports.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Date</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Reporter</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Seller</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Listing</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Reason</th>
                          <th className="min-w-[220px] max-w-[360px] px-3 py-2 font-semibold text-army-purple dark:text-army-300">Details</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listingReports.map((r) => (
                          <tr key={r.id} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(r.createdAt)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.reporterEmail ?? r.reporterUsername ?? "—"}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.sellerEmail ?? "—"}</td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">{r.listingStatus}</div>
                              <div className="font-medium">{r.concertCity} · {r.concertDate}</div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                {r.section} · {r.seatRow} · {r.seat} · {formatPrice(r.faceValuePrice, r.currency)}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{r.reason}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="max-h-24 min-w-[180px] max-w-[340px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded border border-army-purple/15 bg-neutral-50/80 px-2 py-1.5 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                                {r.details ?? "—"}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => openListing(r.listingId)}
                                >
                                  View listing
                                </button>
                                <button
                                  type="button"
                                  disabled={!r.reporterId}
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => r.reporterId && openUserProfile({ userId: r.reporterId, title: `Reporter: ${r.reporterEmail ?? r.reporterUsername ?? "User"}` })}
                                >
                                  Reporter profile
                                </button>
                                <button
                                  type="button"
                                  disabled={!r.sellerId}
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => r.sellerId && openUserProfile({ userId: r.sellerId, title: `Seller: ${r.sellerEmail ?? "User"}` })}
                                >
                                  Seller profile
                                </button>
                                <button
                                  type="button"
                                  disabled={!r.sellerEmail}
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300"
                                  onClick={() => r.sellerEmail && banAndDelete(r.sellerEmail)}
                                >
                                  Ban seller
                                </button>
                                <button type="button" className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300" onClick={() => openRemoveListingModal(r.listingId)}>
                                  Remove listing
                                </button>
                                <button type="button" className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40" onClick={() => deleteListingReport(r.id)}>
                                  Delete report
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
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Date</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Reporter</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Reported</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Reason</th>
                          <th className="min-w-[200px] max-w-[340px] px-3 py-2 font-semibold text-army-purple dark:text-army-300">Details</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Proof</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userReports.map((r) => (
                          <tr key={r.id} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(r.createdAt)}</td>
                            <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.reporterEmail ?? r.reporterUsername ?? "—"}</td>
                            <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.reportedEmail ?? "—"}</td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{r.reason}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="max-h-24 min-w-[180px] max-w-[340px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded border border-army-purple/15 bg-neutral-50/80 px-2 py-1.5 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                                {r.details ?? "—"}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              {userReportProofUrls[r.id] ? (
                                <button type="button" className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40" onClick={() => setUserReportProofOpen({ url: userReportProofUrls[r.id]!, title: `Proof image (${r.reason})` })}>
                                  View proof
                                </button>
                              ) : (
                                <span className="text-xs text-neutral-500">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  disabled={!r.reporterId}
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => r.reporterId && openUserProfile({ userId: r.reporterId, title: `Reporter: ${r.reporterEmail ?? r.reporterUsername ?? "User"}` })}
                                >
                                  Reporter profile
                                </button>
                                <button
                                  type="button"
                                  disabled={!r.reportedUserId}
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => r.reportedUserId && openUserProfile({ userId: r.reportedUserId, title: `Reported user: ${r.reportedEmail ?? "User"}` })}
                                >
                                  Reported profile
                                </button>
                                <button
                                  type="button"
                                  disabled={!r.reportedEmail}
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300"
                                  onClick={() => r.reportedEmail && banAndDelete(r.reportedEmail)}
                                >
                                  Ban reported
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

          {tab === "usersUnderReview" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Users under review</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                Users with at least one user report have their listings hidden from browse. Release listings to make them visible again, or remove and ban the user.
              </p>
              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : usersUnderReview.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No users under review.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Email</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">User reports</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Active listings</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersUnderReview.map((u) => (
                          <tr key={u.user_id} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{u.reported_email}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{u.report_count}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{u.active_listing_count}</td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => openUserProfile({ userId: u.user_id, title: `User: ${u.reported_email}` })}
                                >
                                  View profile
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  onClick={() => releaseUserListings(u.user_id)}
                                  disabled={loading}
                                >
                                  Release listings
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                  onClick={() => banAndDelete(u.reported_email)}
                                  disabled={loading}
                                >
                                  Remove and ban
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

          {tab === "listings" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">Listings</h2>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Status</label>
                <select className="input-army" value={listingsStatus} onChange={(e) => { setListingsStatus(e.target.value); setListingsPage(0); }}>
                  <option value="">All</option>
                  <option value="processing">processing</option>
                  <option value="active">active</option>
                  <option value="locked">locked</option>
                  <option value="sold">sold</option>
                  <option value="removed">removed</option>
                </select>
                <input className="input-army w-[320px]" placeholder="Search city/date/seller email…" value={listingsSearch} onChange={(e) => setListingsSearch(e.target.value)} />
                <button type="button" className="btn-army" onClick={() => { setListingsSearchApplied(listingsSearch.trim()); setListingsPage(0); }}>
                  Search
                </button>
              </div>

              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : listings.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-6 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No listings.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full min-w-[1000px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Created</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Seller</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Listing</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Status</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listings.map((l) => (
                          <tr key={l.id} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(l.createdAt)}</td>
                            <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{l.sellerEmail ?? "—"}</td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">
                              <div className="font-medium">{l.concertCity} · {l.concertDate}</div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                {l.section} · {l.seatRow} · {l.seat} · {formatPrice(l.faceValuePrice, l.currency)}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{l.status}</td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => openListing(l.id)}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  disabled={!l.sellerId}
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => l.sellerId && openUserProfile({ userId: l.sellerId, title: `Owner: ${l.sellerEmail ?? "User"}` })}
                                >
                                  View owner
                                </button>
                                <button
                                  type="button"
                                  disabled={!l.sellerEmail}
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300"
                                  onClick={() => l.sellerEmail && banAndDelete(l.sellerEmail)}
                                >
                                  Ban owner
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                  onClick={() => openRemoveListingModal(l.id)}
                                >
                                  Remove
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

              <div className="mt-4 flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                <span>
                  Page {listingsPage + 1} · {listingsTotal} total
                </span>
                <div className="flex gap-2">
                  <button type="button" className="btn-army-outline" disabled={listingsPage === 0} onClick={() => setListingsPage((p) => Math.max(0, p - 1))}>
                    Prev
                  </button>
                  <button type="button" className="btn-army-outline" disabled={(listingsPage + 1) * 24 >= listingsTotal} onClick={() => setListingsPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}

          {tab === "armyProfileQuestions" && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">ARMY Profile Questions</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                These are the onboarding questions shown in “Finish setup”.
              </p>

              <div className="mb-4 rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                <p className="text-sm font-semibold text-army-purple">Add a question</p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  Note: the app currently collects answers for the built-in keys (bias, years_army, favorite_album). New keys are safe to add, but won’t be collected until the onboarding form is updated.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-sm font-semibold text-army-purple">Key</label>
                    <input className="input-army mt-2" value={newArmyProfileKey} onChange={(e) => setNewArmyProfileKey(e.target.value)} placeholder="e.g. bias" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-army-purple">Prompt</label>
                    <input className="input-army mt-2" value={newArmyProfilePrompt} onChange={(e) => setNewArmyProfilePrompt(e.target.value)} placeholder="Type the question…" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-army-purple">Position</label>
                    <input className="input-army mt-2" value={newArmyProfilePosition} onChange={(e) => setNewArmyProfilePosition(e.target.value)} inputMode="numeric" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <input type="checkbox" checked={newArmyProfileActive} onChange={(e) => setNewArmyProfileActive(e.target.checked)} />
                    Active
                  </label>
                  <button type="button" className="btn-army" onClick={addArmyProfileQuestion} disabled={loading || !newArmyProfileKey.trim() || !newArmyProfilePrompt.trim()}>
                    Add
                  </button>
                </div>
              </div>

              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : (
                <div className="space-y-3">
                  {armyProfileQuestions.map((q) => (
                    <div key={q.key} className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Key</p>
                          <p className="mt-1 font-mono text-sm text-neutral-700 dark:text-neutral-300">{q.key}</p>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={q.active}
                            onChange={(e) => setArmyProfileQuestions((prev) => prev.map((x) => (x.key === q.key ? { ...x, active: e.target.checked } : x)))}
                          />
                          Active
                        </label>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-semibold text-army-purple">Prompt</label>
                          <input
                            className="input-army mt-2"
                            value={q.prompt}
                            onChange={(e) => setArmyProfileQuestions((prev) => prev.map((x) => (x.key === q.key ? { ...x, prompt: e.target.value } : x)))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-army-purple">Position</label>
                          <input
                            className="input-army mt-2"
                            value={String(q.position)}
                            onChange={(e) =>
                              setArmyProfileQuestions((prev) =>
                                prev.map((x) => (x.key === q.key ? { ...x, position: Number(e.target.value) || 0 } : x))
                              )
                            }
                            inputMode="numeric"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-army-outline" onClick={() => deleteArmyProfileQuestion(q.key)} disabled={loading}>
                            Delete
                          </button>
                          <button type="button" className="btn-army" onClick={() => saveArmyProfileQuestion(q)} disabled={loading}>
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "bondingQuestions" && (
            <section>
              <h2 className="mb-2 font-display text-xl font-bold text-army-purple">Connection bonding questions</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                These questions are randomly picked (3) when a seller accepts a connection, and are shown later in the preview/match flow.
              </p>

              <div className="mb-4 rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                <label className="block text-sm font-semibold text-army-purple">Add a new bonding question</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input-army flex-1"
                    value={newBondingPrompt}
                    onChange={(e) => setNewBondingPrompt(e.target.value)}
                    placeholder="Type a prompt…"
                  />
                  <button type="button" className="btn-army" onClick={addBondingQuestion} disabled={loading || !newBondingPrompt.trim()}>
                    Add
                  </button>
                </div>
              </div>

              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : bondingQuestions.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No bonding questions found.
                </p>
              ) : (
                <div className="space-y-3">
                  {bondingQuestions.map((q) => (
                    <div key={q.id} className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={q.active}
                            onChange={(e) => setBondingQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, active: e.target.checked } : x)))}
                          />
                          Active
                        </label>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Created: {formatDate(q.createdAt)}</div>
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-semibold text-army-purple">Prompt</label>
                        <textarea
                          rows={2}
                          className="input-army mt-2 resize-none"
                          value={q.prompt}
                          onChange={(e) => setBondingQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x)))}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button type="button" className="btn-army-outline" onClick={() => deleteBondingQuestion(q.id)} disabled={loading}>
                          Delete
                        </button>
                        <button type="button" className="btn-army" onClick={() => saveBondingQuestion(q)} disabled={loading}>
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "stories" && (
            <section>
              <h2 className="mb-2 font-display text-xl font-bold text-army-purple">ARMY Stories & Feedback</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">Pending/rejected submissions (approved stories are visible publicly).</p>

              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : stories.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No pending stories.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Date</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Status</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Author</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Title</th>
                          <th className="min-w-[320px] px-3 py-2 font-semibold text-army-purple dark:text-army-300">Body</th>
                          <th className="min-w-[200px] px-3 py-2 font-semibold text-army-purple dark:text-army-300">Admin reply (optional)</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stories.map((s) => (
                          <tr key={s.id} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(s.createdAt)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-800 dark:text-neutral-200">{s.status}</td>
                            <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                              {s.anonymous ? "Anonymous" : s.authorUsername}
                              <div className="mt-1">
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => openUserProfile({ userId: s.authorId, title: `Story author: ${s.authorUsername}` })}
                                >
                                  View author
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{s.title}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded border border-army-purple/15 bg-neutral-50/80 px-2 py-1.5 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                                {s.body}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <textarea
                                className="min-h-[60px] w-full rounded border border-army-purple/20 bg-white px-2 py-1 text-xs text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
                                placeholder="Optional reply (shown when published)"
                                value={storyReplyDrafts[s.id] ?? ""}
                                onChange={(e) =>
                                  setStoryReplyDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                                rows={2}
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  onClick={() =>
                                    moderateStory(s.id, "approved", storyReplyDrafts[s.id]?.trim() || null)
                                  }
                                  disabled={loading}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-neutral-200 px-2 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600"
                                  onClick={() => moderateStory(s.id, "rejected")}
                                  disabled={loading}
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                  onClick={() => removeStory(s.id)}
                                  disabled={loading}
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

              {approvedStories.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-3 font-display text-lg font-semibold text-army-purple dark:text-army-300">
                    Approved stories (add admin reply)
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <div className="max-h-[50vh] overflow-auto">
                      <table className="w-full min-w-[800px] text-left text-sm">
                        <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Date</th>
                            <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Title</th>
                            <th className="min-w-[200px] px-3 py-2 font-semibold text-army-purple dark:text-army-300">Replies</th>
                            <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {approvedStories.map((s) => (
                            <tr key={s.id} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                              <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">
                                {formatDate(s.createdAt)}
                              </td>
                              <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{s.title}</td>
                              <td className="px-3 py-2">
                                <div className="max-h-24 overflow-y-auto whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                                  {(s.replies?.length ?? 0) === 0
                                    ? "—"
                                    : s.replies!.map((r) => (
                                        <div key={r.id} className="mb-1 border-b border-army-purple/10 pb-1 last:mb-0 last:border-0 last:pb-0">
                                          <span className="text-xs font-semibold text-army-purple/80 dark:text-army-300/80">
                                            {r.replyType === "admin" ? "Team" : "Author"}
                                          </span>
                                          {" · "}
                                          {new Date(r.createdAt).toLocaleDateString()}
                                          <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">{r.body}</p>
                                        </div>
                                      ))}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                  onClick={() =>
                                    setStoryReplyEdit({
                                      id: s.id,
                                      title: s.title,
                                      reply: "",
                                    })
                                  }
                                  disabled={loading}
                                >
                                  Add reply
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {storyReplyEdit && (
            <div
              className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setStoryReplyEdit(null)}
            >
              <div
                className="w-full max-w-lg cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-display text-lg font-bold text-army-purple">Add admin reply</h3>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{storyReplyEdit.title}</p>
                <textarea
                  className="input-army mt-3 min-h-[120px] w-full resize-y"
                  placeholder="Your comment or answer (shown under the story on the public page)"
                  value={storyReplyEdit.reply}
                  onChange={(e) =>
                    setStoryReplyEdit((prev) => (prev ? { ...prev, reply: e.target.value } : null))
                  }
                  rows={4}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-army-outline"
                    onClick={() => setStoryReplyEdit(null)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-army"
                    onClick={() => saveStoryReply(storyReplyEdit.id, storyReplyEdit.reply)}
                    disabled={loading || !storyReplyEdit.reply.trim()}
                  >
                    {loading ? "Saving…" : "Add reply"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {questionReplyModal && (
            <div
              className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="question-reply-title"
              onClick={() => { setQuestionReplyModal(null); setQuestionReplyDraft(""); }}
            >
              <div
                className="w-full max-w-lg cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="question-reply-title" className="font-display text-lg font-bold text-army-purple">Reply to question</h3>
                <p className="mt-1 max-h-24 overflow-y-auto text-sm text-neutral-600 dark:text-neutral-400">{questionReplyModal.text}</p>
                <textarea
                  className="input-army mt-3 min-h-[120px] w-full resize-y"
                  placeholder="Your reply (shown on the Questions page)"
                  value={questionReplyDraft}
                  onChange={(e) => setQuestionReplyDraft(e.target.value)}
                  rows={4}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-army-outline"
                    onClick={() => { setQuestionReplyModal(null); setQuestionReplyDraft(""); }}
                    disabled={questionReplySaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-army"
                    onClick={submitQuestionReply}
                    disabled={questionReplySaving || !questionReplyDraft.trim()}
                  >
                    {questionReplySaving ? "Sending…" : "Post reply"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "recommendations" && (
            <section>
              <h2 className="mb-2 font-display text-xl font-bold text-army-purple">Recommendations</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">Community recommendations sent to admins.</p>

              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : recommendations.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No recommendations.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full min-w-[1000px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Date</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Title</th>
                          <th className="min-w-[360px] px-3 py-2 font-semibold text-army-purple dark:text-army-300">Body</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recommendations.map((r) => (
                          <tr key={r.id} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(r.createdAt)}</td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{r.title}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded border border-army-purple/15 bg-neutral-50/80 px-2 py-1.5 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                                {r.body}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => openUserProfile({ userId: r.authorId, title: "Recommendation author" })}
                                >
                                  View author
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                  onClick={() => removeRecommendation(r.id)}
                                  disabled={loading}
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

          {tab === "unansweredQuestions" && (
            <section>
              <h2 className="mb-2 font-display text-xl font-bold text-army-purple">Unanswered questions</h2>
              <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">Questions from the Questions page with no admin reply yet. Reply here or remove if inappropriate.</p>

              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : unansweredQuestions.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No unanswered questions.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Date</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Author</th>
                          <th className="min-w-[280px] px-3 py-2 font-semibold text-army-purple dark:text-army-300">Question</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unansweredQuestions.map((q) => (
                          <tr key={q.id} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(q.createdAt)}</td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{q.authorLabel}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded border border-army-purple/15 bg-neutral-50/80 px-2 py-1.5 text-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300">
                                {q.text}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="rounded bg-army-purple/10 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/20 dark:bg-army-purple/20 dark:hover:bg-army-purple/30"
                                  onClick={() => {
                                    setQuestionReplyModal({ questionId: q.id, text: q.text });
                                    setQuestionReplyDraft("");
                                  }}
                                  disabled={loading}
                                >
                                  Reply
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                  onClick={() => removeQuestion(q.id)}
                                  disabled={loading}
                                >
                                  Remove
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

          {(tab === "sellers" || tab === "buyers" || tab === "users") && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-army-purple">
                {tab === "sellers" ? "Sellers" : tab === "buyers" ? "Buyers" : "All users"}
              </h2>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  className="input-army w-[320px]"
                  placeholder="Search email…"
                  value={tab === "sellers" ? sellersSearch : tab === "buyers" ? buyersSearch : allUsersSearch}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (tab === "sellers") setSellersSearch(v);
                    else if (tab === "buyers") setBuyersSearch(v);
                    else setAllUsersSearch(v);
                  }}
                />
                <button
                  type="button"
                  className="btn-army"
                  onClick={() => {
                    if (tab === "sellers") {
                      setSellersSearchApplied(sellersSearch.trim());
                      setSellersPage(0);
                    } else if (tab === "buyers") {
                      setBuyersSearchApplied(buyersSearch.trim());
                      setBuyersPage(0);
                    } else {
                      setAllUsersSearchApplied(allUsersSearch.trim());
                      setAllUsersPage(0);
                    }
                  }}
                >
                  Search
                </button>
              </div>

              {loading ? (
                <p className="text-neutral-500">Loading…</p>
              ) : (
                <>
                  <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
                    <div className="max-h-[70vh] overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Email</th>
                            <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Created</th>
                            <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Last login</th>
                            <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Country</th>
                            <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Last login country</th>
                            <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tab === "sellers" ? sellers : tab === "buyers" ? buyers : allUsers).map((u) => (
                            <tr key={u.id} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                              <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{u.email}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(u.createdAt)}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(u.lastLoginAt)}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400" title="Profile country (onboarding)">
                                {u.country?.trim() ? u.country : "—"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400" title="Country from last login (geo)">
                                {u.lastLoginCountry ?? "—"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40"
                                    onClick={() => openUserProfile({ userId: u.id, title: `User: ${u.email}` })}
                                  >
                                    View user
                                  </button>
                                  <button type="button" className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300" onClick={() => banAndDelete(u.email)}>
                                    Ban & delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                    <span>
                      {tab === "sellers"
                        ? `Page ${sellersPage + 1} · ${sellersTotal} total`
                        : tab === "buyers"
                          ? `Page ${buyersPage + 1} · ${buyersTotal} total`
                          : `Page ${allUsersPage + 1} · ${allUsersTotal} total`}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-army-outline"
                        disabled={(tab === "sellers" ? sellersPage : tab === "buyers" ? buyersPage : allUsersPage) === 0}
                        onClick={() => {
                          if (tab === "sellers") setSellersPage((p) => Math.max(0, p - 1));
                          else if (tab === "buyers") setBuyersPage((p) => Math.max(0, p - 1));
                          else setAllUsersPage((p) => Math.max(0, p - 1));
                        }}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        className="btn-army-outline"
                        disabled={
                          tab === "sellers"
                            ? (sellersPage + 1) * 24 >= sellersTotal
                            : tab === "buyers"
                              ? (buyersPage + 1) * 24 >= buyersTotal
                              : (allUsersPage + 1) * 24 >= allUsersTotal
                        }
                        onClick={() => {
                          if (tab === "sellers") setSellersPage((p) => p + 1);
                          else if (tab === "buyers") setBuyersPage((p) => p + 1);
                          else setAllUsersPage((p) => p + 1);
                        }}
                      >
                        Next
                      </button>
                    </div>
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
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Email</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Banned at</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Reason</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {banned.map((b) => (
                          <tr key={b.email} className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10">
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{b.email}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{formatDate(b.bannedAt)}</td>
                            <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{b.reason ?? "—"}</td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <button type="button" className="rounded bg-army-purple/20 px-2 py-1 text-xs font-medium text-army-purple hover:bg-army-purple/30 dark:bg-army-purple/30 dark:hover:bg-army-purple/40" onClick={() => unban(b.email)}>
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

      {profileOpen && (
        <LiteProfileModal
          open={true}
          onClose={() => setProfileOpen(null)}
          userId={profileOpen.userId}
          title={profileOpen.title}
        />
      )}

      {listingOpen && (
        <AdminListingModal
          open={true}
          onClose={() => setListingOpen(null)}
          listingId={listingOpen.listingId}
        />
      )}

      {removeListingModal && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-listing-title"
          onClick={() => setRemoveListingModal(null)}
        >
          <div
            className="modal-panel w-full max-w-md cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-listing-title" className="font-display text-xl font-bold text-army-purple">
              Remove listing
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              This will remove the listing and end any connection. The seller will not be notified unless you add a message below.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-semibold text-army-purple" htmlFor="remove-listing-message">
                Message to seller (optional)
              </label>
              <textarea
                id="remove-listing-message"
                className="input-army mt-1 min-h-[100px] w-full resize-y"
                placeholder="e.g. Reason for removal, or instructions…"
                value={removeListingMessage}
                onChange={(e) => setRemoveListingMessage(e.target.value)}
                disabled={loading}
                rows={3}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-army-outline"
                onClick={() => setRemoveListingModal(null)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                onClick={confirmRemoveListing}
                disabled={loading}
              >
                {loading ? "Removing…" : "Remove listing"}
              </button>
            </div>
          </div>
        </div>
      )}

      {userReportProofOpen && (
        <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4" onClick={() => setUserReportProofOpen(null)}>
          <div className="w-full max-w-2xl cursor-default overflow-hidden rounded-2xl border border-army-purple/20 bg-white p-4 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-army-purple">{userReportProofOpen.title}</h3>
              <button type="button" className="btn-army-outline" onClick={() => setUserReportProofOpen(null)}>
                Close
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-army-purple/15 bg-black/5 p-2 dark:border-army-purple/25 dark:bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={userReportProofOpen.url} alt={userReportProofOpen.title} className="h-auto w-full rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

