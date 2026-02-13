"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import ImageLightbox from "@/components/ImageLightbox";
import MerchListingReportModal from "@/components/MerchListingReportModal";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";
import {
  fetchBrowseMerchListings,
  fetchMerchCategories,
  fetchMyMerchListings,
  fetchMyMerchConnections,
  createMerchListing,
  updateMerchListing,
  deleteMerchListing,
  connectToMerchListingV2,
  endMerchConnection,
  fetchMerchListingSellerProfileForConnect,
  getConnectionBondingQuestionIds,
  type MerchCategory,
  type MerchListingCard,
  type MyMerchListing,
  type MerchConnectionRow,
  type MerchSellerProfileForConnect,
} from "@/lib/supabase/merch";
import { CURRENCY_OPTIONS } from "@/lib/data/currencies";
import { hasUserBondingAnswers, upsertUserBondingAnswers } from "@/lib/supabase/listings";
import { supabase } from "@/lib/supabaseClient";
import { uploadMerchListingImage } from "@/lib/supabase/uploadChannelImage";

/** BTS official tours (OT7 and solo) for merch tour filter. */
const MERCH_TOUR_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "red_bullet", label: "The Red Bullet Tour" },
  { value: "hyyh_on_stage", label: "The Most Beautiful Moment in Life On Stage" },
  { value: "wings", label: "The Wings Tour" },
  { value: "love_yourself", label: "Love Yourself World Tour" },
  { value: "speak_yourself", label: "Love Yourself: Speak Yourself" },
  { value: "map_of_the_soul", label: "Map of the Soul Tour" },
  { value: "ptd", label: "Permission to Dance on Stage" },
  { value: "wake_up", label: "Wake Up: Open Your Eyes" },
  { value: "agust_d_day", label: "SUGA | Agust D Tour 'D-Day'" },
  { value: "hope_on_stage", label: "j-hope Tour 'HOPE ON THE STAGE'" },
  { value: "runseokjin_ep", label: "Jin - RunSeokjin Ep. Tour" },
  { value: "muster", label: "Muster / Fanmeeting" },
  { value: "other", label: "Other" },
];

/** Required Collection / Event filter for merch listings. */
const MERCH_COLLECTION_EVENT_OPTIONS: { value: string; label: string }[] = [
  { value: "tour", label: "Tour" },
  { value: "are_you_sure", label: "Are you Sure ?" },
  { value: "bon_voyage", label: "Bon Voyage" },
  { value: "festa", label: "Festa" },
  { value: "muster", label: "Muster" },
  { value: "seasons_greetings", label: "Season's Greetings" },
  { value: "memories", label: "Memories" },
  { value: "popup_store", label: "Pop-up Store" },
  { value: "artist_made", label: "Artist Made Collection" },
  { value: "run_bts", label: "Run BTS" },
  { value: "in_the_soop", label: "In the SOOP" },
  { value: "none_general", label: "None / General" },
];

type MerchTab = "all" | "connections" | "my";

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function merchStatusPill(status: string): { label: string; cls: string } {
  const s = String(status || "").toLowerCase();
  if (s === "sold") return { label: "Sold", cls: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100" };
  if (s === "locked") return { label: "Locked", cls: "bg-amber-500/15 text-amber-900 dark:text-amber-200" };
  return { label: "Active", cls: "bg-army-200/60 text-army-900 dark:bg-army-300/25 dark:text-army-200" };
}

const FILTER_OPTION_LABELS: Record<string, string> = {
  sealed: "Sealed",
  member: "Member",
  tour: "Tour",
  condition: "Condition",
  official_replica: "Official / Replica",
  version: "Version",
  size: "Size",
  color: "Color",
  collection_event: "Collection / Event",
};
function formatFilterOptionKey(key: string): string {
  return FILTER_OPTION_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MerchBoardView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<MerchTab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [browse, setBrowse] = useState<MerchListingCard[]>([]);
  const [mine, setMine] = useState<MyMerchListing[]>([]);
  const [connections, setConnections] = useState<MerchConnectionRow[]>([]);

  const [categories, setCategories] = useState<MerchCategory[]>([]);
  const [browseCategorySlug, setBrowseCategorySlug] = useState<string>("");
  const [browseSubcategorySlug, setBrowseSubcategorySlug] = useState<string>("");
  const [browseFilterSealed, setBrowseFilterSealed] = useState<string>("");
  const [browseFilterMember, setBrowseFilterMember] = useState<string>("");
  const [browseFilterTour, setBrowseFilterTour] = useState<string>("");
  const [browseFilterCondition, setBrowseFilterCondition] = useState<string>("");
  const [browseFilterOfficialReplica, setBrowseFilterOfficialReplica] = useState<string>("");
  const [browseFilterCollectionEvent, setBrowseFilterCollectionEvent] = useState<string>("");

  const [postOpen, setPostOpen] = useState(false);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postDescription, setPostDescription] = useState("");
  const [postQuantity, setPostQuantity] = useState(1);
  const [postPrice, setPostPrice] = useState("");
  const [postCurrency, setPostCurrency] = useState("USD");
  const [postSize, setPostSize] = useState("");
  const [postColor, setPostColor] = useState("");
  const [postImage1, setPostImage1] = useState<File | null>(null);
  const [postImage2, setPostImage2] = useState<File | null>(null);
  const [postCategorySlug, setPostCategorySlug] = useState("other");
  const [postSubcategorySlug, setPostSubcategorySlug] = useState("");
  const [postCollectionEvent, setPostCollectionEvent] = useState("none_general");
  const [postIsFanmade, setPostIsFanmade] = useState(false);
  const [postFanmadeDisclaimerAccepted, setPostFanmadeDisclaimerAccepted] = useState(false);
  const [postFilterSealed, setPostFilterSealed] = useState("");
  const [postFilterMember, setPostFilterMember] = useState("");
  const [postFilterTour, setPostFilterTour] = useState("");
  const [postFilterCondition, setPostFilterCondition] = useState("");
  const [postFilterOfficialReplica, setPostFilterOfficialReplica] = useState("");
  const [postFilterVersion, setPostFilterVersion] = useState("");

  const [showBondingModal, setShowBondingModal] = useState(false);
  const [bondingAnswers, setBondingAnswers] = useState<Record<string, string>>({});
  const [bondingPrompts, setBondingPrompts] = useState<Array<{ id: string; prompt: string }>>([]);
  const [bondingQuestionIds, setBondingQuestionIds] = useState<string[]>([]);
  const [bondingSubmitting, setBondingSubmitting] = useState(false);
  const [pendingMerchCreate, setPendingMerchCreate] = useState<Parameters<typeof createMerchListing>[0] | null>(null);
  const [showSocialsModal, setShowSocialsModal] = useState(false);
  const [sellerComfortableSocials, setSellerComfortableSocials] = useState<boolean | null>(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyAck1, setSafetyAck1] = useState(false);
  const [safetyAck2, setSafetyAck2] = useState(false);

  const [connectListingId, setConnectListingId] = useState<string | null>(null);
  const [connectSummary, setConnectSummary] = useState("");
  const [connectSellerProfile, setConnectSellerProfile] = useState<{ data: MerchSellerProfileForConnect | null; loading: boolean; error: string | null }>({ data: null, loading: false, error: null });
  const [connectSocialShare, setConnectSocialShare] = useState<boolean | null>(null);
  const [connectBondingAnswers, setConnectBondingAnswers] = useState<Record<string, string>>({});
  const [connectQuestionIds, setConnectQuestionIds] = useState<string[]>([]);
  const [connectBondingPrompts, setConnectBondingPrompts] = useState<Array<{ id: string; prompt: string }>>([]);
  const [connectHasBonding, setConnectHasBonding] = useState<boolean | null>(null);
  const [connectSubmitting, setConnectSubmitting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState("");
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState<{ merchListingId: string; summary: string } | null>(null);
  const [detailListing, setDetailListing] = useState<MerchListingCard | null>(null);
  const [editListing, setEditListing] = useState<MyMerchListing | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MyMerchListing | null>(null);

  const { notifications } = useNotifications();
  const unreadMerchConnectionNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read && !!n.merchConnectionId).length,
    [notifications]
  );
  const unreadMerchConnectionIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of notifications) {
      if (!n.read && n.merchConnectionId) set.add(n.merchConnectionId);
    }
    return set;
  }, [notifications]);
  const unreadMerchConnectionCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notifications) {
      if (n.read || !n.merchConnectionId) continue;
      map.set(n.merchConnectionId, (map.get(n.merchConnectionId) ?? 0) + 1);
    }
    return map;
  }, [notifications]);

  const myPendingMerchConnectionByListingId = useMemo(() => {
    if (!user) return new Map<string, MerchConnectionRow>();
    const map = new Map<string, MerchConnectionRow>();
    for (const c of connections) {
      if (c.buyerId !== user.id || c.stage !== "pending_seller") continue;
      map.set(c.merchListingId, c);
    }
    return map;
  }, [connections, user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const [bRes, mRes, cRes] = await Promise.all([
      fetchBrowseMerchListings({
        categorySlug: browseCategorySlug || null,
        subcategorySlug: browseSubcategorySlug || null,
        filterSealed: browseFilterSealed || null,
        filterMember: browseFilterMember || null,
        filterTour: browseFilterTour || null,
        filterCondition: browseFilterCondition || null,
        filterOfficialReplica: browseFilterOfficialReplica || null,
        filterCollectionEvent: browseFilterCollectionEvent || null,
      }),
      fetchMyMerchListings(user.id),
      fetchMyMerchConnections(user.id),
    ]);
    if (bRes.error) setError(bRes.error);
    if (mRes.error) setError(mRes.error);
    if (cRes.error) setError(cRes.error);
    setBrowse(bRes.data);
    setMine(mRes.data);
    const finished = new Set(["ended", "expired", "declined"]);
    const active = cRes.data.filter((x) => !finished.has(x.stage));
    const ended = cRes.data.filter((x) => finished.has(x.stage));
    setConnections([...active, ...ended]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id, browseCategorySlug, browseSubcategorySlug, browseFilterSealed, browseFilterMember, browseFilterTour, browseFilterCondition, browseFilterOfficialReplica, browseFilterCollectionEvent]);

  useEffect(() => {
    if (!user) return;
    fetchMerchCategories().then((r) => {
      if (r.data.length) setCategories(r.data);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!editListing) return;
    setPostTitle(editListing.title);
    setPostDescription(editListing.description ?? "");
    setPostQuantity(editListing.quantity);
    setPostPrice(String(editListing.price));
    setPostCurrency(editListing.currency);
    setPostCategorySlug(editListing.categorySlug ?? "other");
    setPostSubcategorySlug(editListing.subcategorySlug ?? "");
    setPostIsFanmade(editListing.isFanmade ?? false);
    const fo = editListing.filterOptions as Record<string, string> | undefined;
    if (fo) {
      setPostSize(fo.size ?? "");
      setPostColor(fo.color ?? "");
      setPostFilterSealed(fo.sealed ?? "");
      setPostFilterMember(fo.member ?? "");
      setPostFilterTour(fo.tour ?? "");
      setPostFilterCondition(fo.condition ?? "");
      setPostFilterOfficialReplica(fo.official_replica ?? "");
      setPostFilterVersion(fo.version ?? "");
      setPostCollectionEvent(fo.collection_event ?? "none_general");
    } else {
      setPostCollectionEvent("none_general");
    }
  }, [editListing?.id]);

  useEffect(() => {
    if (!connectListingId || !user) return;
    setConnectSellerProfile({ data: null, loading: true, error: null });
    setConnectSocialShare(null);
    setConnectBondingAnswers({});
    setConnectError(null);
    (async () => {
      const [profileRes, qRes, hasBonding] = await Promise.all([
        fetchMerchListingSellerProfileForConnect(connectListingId),
        getConnectionBondingQuestionIds(),
        hasUserBondingAnswers(user.id),
      ]);
      setConnectSellerProfile({ data: profileRes.data, loading: false, error: profileRes.error });
      setConnectHasBonding(hasBonding);
      if (qRes.data?.length === 2) {
        setConnectQuestionIds(qRes.data);
        const { data: rows } = await supabase.from("bonding_questions").select("id, prompt").in("id", qRes.data);
        setConnectBondingPrompts(
          (rows ?? []).map((r: { id: string; prompt: string }) => ({ id: r.id, prompt: r.prompt ?? "Question" }))
        );
      } else {
        setConnectBondingPrompts([]);
      }
      if (profileRes.data && qRes.data?.length === 2 && !hasBonding) {
        const init: Record<string, string> = {};
        qRes.data.forEach((id) => { init[id] = ""; });
        setConnectBondingAnswers(init);
      }
    })();
  }, [connectListingId, user?.id]);

  const handlePostSubmit = async () => {
    if (!user) return;
    const title = postTitle.trim();
    const priceNum = parseFloat(postPrice);
    if (!title) {
      setError("Title is required.");
      return;
    }
    if (postQuantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("Enter a valid price.");
      return;
    }
    if (!postCollectionEvent || !postCollectionEvent.trim()) {
      setError("Please select a Collection / Event.");
      return;
    }
    if (postIsFanmade && !postFanmadeDisclaimerAccepted) {
      setError("You must accept the fanmade disclaimer for fanmade items.");
      return;
    }
    setPostSubmitting(true);
    setError(null);
    const filterOptions: Record<string, string> = {};
    if (postFilterSealed.trim()) filterOptions.sealed = postFilterSealed.trim();
    if (postFilterMember.trim()) filterOptions.member = postFilterMember.trim();
    if (postFilterTour.trim()) filterOptions.tour = postFilterTour.trim();
    if (postFilterCondition.trim()) filterOptions.condition = postFilterCondition.trim();
    if (postFilterOfficialReplica.trim()) filterOptions.official_replica = postFilterOfficialReplica.trim();
    if (postFilterVersion.trim()) filterOptions.version = postFilterVersion.trim();
    if (postSize.trim()) filterOptions.size = postSize.trim();
    if (postColor.trim()) filterOptions.color = postColor.trim();
    filterOptions.collection_event = postCollectionEvent.trim();

    const images: string[] = [];
    if (user.id) {
      if (postImage1) {
        const r1 = await uploadMerchListingImage(postImage1, user.id);
        if ("error" in r1) {
          setPostSubmitting(false);
          setError(r1.error);
          return;
        }
        images.push(r1.url);
      }
      if (postImage2) {
        const r2 = await uploadMerchListingImage(postImage2, user.id);
        if ("error" in r2) {
          setPostSubmitting(false);
          setError(r2.error);
          return;
        }
        images.push(r2.url);
      }
    }

    const params: Parameters<typeof createMerchListing>[0] = {
      title,
      description: postDescription.trim() || undefined,
      quantity: postQuantity,
      price: priceNum,
      currency: postCurrency,
      images: images.length ? images : undefined,
      categorySlug: postCategorySlug || "other",
      subcategorySlug: postSubcategorySlug || null,
      isFanmade: postIsFanmade,
      fanmadeDisclaimerAccepted: postIsFanmade ? postFanmadeDisclaimerAccepted : undefined,
      filterOptions: Object.keys(filterOptions).length ? filterOptions : undefined,
    };
    setPendingMerchCreate(params);
    setPostSubmitting(false);

    try {
      const hasBonding = await hasUserBondingAnswers(user.id);
      if (hasBonding) {
        setShowSocialsModal(true);
      } else {
        const { data: ids } = await getConnectionBondingQuestionIds();
        const idList = ids ?? [];
        setBondingQuestionIds(idList);
        if (idList.length >= 2) {
          const { data: rows } = await supabase.from("bonding_questions").select("id, prompt").in("id", idList);
          setBondingPrompts(
            idList.map((id) => ({ id, prompt: String((rows as any[]).find((r: any) => r.id === id)?.prompt ?? "Question") }))
          );
          setShowBondingModal(true);
        } else {
          setShowSocialsModal(true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check setup");
    }
  };

  const resetPostFlow = () => {
    setShowBondingModal(false);
    setBondingAnswers({});
    setBondingPrompts([]);
    setBondingQuestionIds([]);
    setPendingMerchCreate(null);
    setShowSocialsModal(false);
    setSellerComfortableSocials(null);
    setShowSafetyModal(false);
    setSafetyAck1(false);
    setSafetyAck2(false);
  };

  const resetPostForm = () => {
    setPostTitle("");
    setPostDescription("");
    setPostQuantity(1);
    setPostPrice("");
    setPostCurrency("USD");
    setPostSize("");
    setPostColor("");
    setPostImage1(null);
    setPostImage2(null);
    setPostCategorySlug("other");
    setPostSubcategorySlug("");
    setPostCollectionEvent("none_general");
    setPostIsFanmade(false);
    setPostFanmadeDisclaimerAccepted(false);
    setPostFilterSealed("");
    setPostFilterMember("");
    setPostFilterTour("");
    setPostFilterCondition("");
    setPostFilterOfficialReplica("");
    setPostFilterVersion("");
  };

  const submitBondingThenSocials = async () => {
    if (!pendingMerchCreate || bondingQuestionIds.length < 2) return;
    const a = bondingAnswers;
    if (!bondingQuestionIds.every((id) => (a[id] ?? "").trim())) {
      setError("Please answer both questions.");
      return;
    }
    setBondingSubmitting(true);
    setError(null);
    try {
      const answers = Object.fromEntries(bondingQuestionIds.map((id) => [id, (a[id] ?? "").trim()]));
      const { error: e } = await upsertUserBondingAnswers(bondingQuestionIds, answers);
      if (e) {
        setError(e);
        return;
      }
      setShowBondingModal(false);
      setBondingAnswers({});
      setShowSocialsModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBondingSubmitting(false);
    }
  };

  const doCreateMerchListing = async () => {
    if (!pendingMerchCreate) return;
    setPostSubmitting(true);
    setError(null);
    try {
      const { error: e } = await createMerchListing(pendingMerchCreate);
      if (e) {
        setError(e);
        return;
      }
      setShowSafetyModal(false);
      setPendingMerchCreate(null);
      setSafetyAck1(false);
      setSafetyAck2(false);
      setPostOpen(false);
      resetPostForm();
      resetPostFlow();
      await load();
      setTab("my");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing");
    } finally {
      setPostSubmitting(false);
    }
  };

  const handleMarkSold = async (m: MyMerchListing) => {
    setError(null);
    const res = await fetch("/api/merch-listings/mark-sold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchListingId: m.id }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !j?.ok) {
      setError(j?.error ?? `HTTP ${res.status}`);
      return;
    }
    await load();
  };

  const handleDelete = async (m: MyMerchListing) => {
    const { error: e } = await deleteMerchListing(m.id);
    if (e) {
      setError(e);
      return;
    }
    setMine((prev) => prev.filter((x) => x.id !== m.id));
    setDeleteConfirm(null);
  };

  const handleEditSubmit = async () => {
    if (!editListing) return;
    const price = parseFloat(postPrice);
    if (Number.isNaN(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }
    const filterOptions: Record<string, string> = {};
    if (postFilterSealed.trim()) filterOptions.sealed = postFilterSealed.trim();
    if (postFilterMember.trim()) filterOptions.member = postFilterMember.trim();
    if (postFilterTour.trim()) filterOptions.tour = postFilterTour.trim();
    if (postFilterCondition.trim()) filterOptions.condition = postFilterCondition.trim();
    if (postFilterOfficialReplica.trim()) filterOptions.official_replica = postFilterOfficialReplica.trim();
    if (postFilterVersion.trim()) filterOptions.version = postFilterVersion.trim();
    if (postSize.trim()) filterOptions.size = postSize.trim();
    if (postColor.trim()) filterOptions.color = postColor.trim();
    filterOptions.collection_event = postCollectionEvent.trim();

    setPostSubmitting(true);
    setError(null);
    try {
      const { data, error: e } = await updateMerchListing(editListing.id, {
        title: postTitle.trim(),
        description: postDescription.trim() || null,
        quantity: postQuantity,
        price,
        currency: postCurrency,
        categorySlug: postCategorySlug || "other",
        subcategorySlug: postSubcategorySlug || null,
        isFanmade: postIsFanmade,
        filterOptions: Object.keys(filterOptions).length ? filterOptions : undefined,
      });
      if (e) {
        setError(e);
        return;
      }
      if (data) setMine((prev) => prev.map((x) => (x.id === editListing.id ? data : x)));
      setEditListing(null);
      setPostOpen(false);
      resetPostForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update listing");
    } finally {
      setPostSubmitting(false);
    }
  };

  const handleConnectSubmit = async () => {
    if (!connectListingId) return;
    if (connectSocialShare === null) {
      setConnectError("Please choose whether to share socials.");
      return;
    }
    if (connectHasBonding === false && connectQuestionIds.length === 2) {
      const a = connectBondingAnswers;
      if (!connectQuestionIds.every((id) => (a[id] ?? "").trim())) {
        setConnectError("Please answer both bonding questions.");
        return;
      }
    }
    setConnectSubmitting(true);
    setConnectError(null);
    const bonding = connectHasBonding === false && connectQuestionIds.length >= 2
      ? Object.fromEntries(connectQuestionIds.map((id) => [id, (connectBondingAnswers[id] ?? "").trim()]))
      : undefined;
    const questionIds = connectHasBonding === false && connectQuestionIds.length >= 2 ? connectQuestionIds : undefined;
    const { connectionId, error: e } = await connectToMerchListingV2(connectListingId, connectSocialShare, bonding, questionIds);
    setConnectSubmitting(false);
    if (e) {
      setConnectError(e);
      return;
    }
    setConnectListingId(null);
    if (connectionId) window.location.href = `/merch/connections/${encodeURIComponent(connectionId)}`;
  };

  return (
    <RequireAuth>
      <div className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold text-army-purple sm:text-3xl">Merch</h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
              BTS merch at face value.
            </p>
          </div>
          <button type="button" className="btn-army" title="Post a merch listing" onClick={() => { setEditListing(null); resetPostForm(); setPostOpen(true); }}>
            Post Merch Listing
          </button>
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
            {unreadMerchConnectionNotificationCount > 0 && (
              <span
                className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  tab === "connections" ? "bg-white text-army-purple" : "bg-army-purple text-white"
                }`}
                aria-label={`${unreadMerchConnectionNotificationCount} unread merch connection updates`}
              >
                {unreadMerchConnectionNotificationCount > 99 ? "99+" : unreadMerchConnectionNotificationCount}
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

        <div className="mt-6">
          {loading ? (
            <p className="text-center text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : tab === "all" ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Category</label>
                <select
                  value={browseCategorySlug}
                  onChange={(e) => { setBrowseCategorySlug(e.target.value); setBrowseSubcategorySlug(""); }}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                >
                  <option value="">All</option>
                  {categories.filter((c) => !c.parentSlug).map((c) => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select>
                {browseCategorySlug && categories.some((c) => c.parentSlug === browseCategorySlug) && (
                  <>
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Subcategory</label>
                    <select
                      value={browseSubcategorySlug}
                      onChange={(e) => setBrowseSubcategorySlug(e.target.value)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                    >
                      <option value="">All</option>
                      {categories.filter((c) => c.parentSlug === browseCategorySlug).map((c) => (
                        <option key={c.slug} value={c.slug}>{c.label}</option>
                      ))}
                    </select>
                  </>
                )}
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Collection / Event</label>
                <select value={browseFilterCollectionEvent} onChange={(e) => setBrowseFilterCollectionEvent(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                  <option value="">Any</option>
                  {MERCH_COLLECTION_EVENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Sealed</label>
                <select value={browseFilterSealed} onChange={(e) => setBrowseFilterSealed(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                  <option value="">Any</option>
                  <option value="sealed">Sealed</option>
                  <option value="opened">Opened</option>
                </select>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Member</label>
                <select value={browseFilterMember} onChange={(e) => setBrowseFilterMember(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                  <option value="">Any</option>
                  <option value="RM">RM</option>
                  <option value="Jin">Jin</option>
                  <option value="SUGA">SUGA</option>
                  <option value="j-hope">j-hope</option>
                  <option value="Jimin">Jimin</option>
                  <option value="V">V</option>
                  <option value="Jungkook">Jungkook</option>
                  <option value="OT7">OT7</option>
                </select>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tour</label>
                <select value={browseFilterTour} onChange={(e) => setBrowseFilterTour(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                  {MERCH_TOUR_OPTIONS.map((o) => (
                    <option key={o.value || "any"} value={o.value}>{o.value ? o.label : "Any"}</option>
                  ))}
                </select>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Condition</label>
                <select value={browseFilterCondition} onChange={(e) => setBrowseFilterCondition(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                  <option value="">Any</option>
                  <option value="like_new">Like new</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="used">Used</option>
                </select>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Official/Replica</label>
                <select value={browseFilterOfficialReplica} onChange={(e) => setBrowseFilterOfficialReplica(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                  <option value="">Any</option>
                  <option value="official">Official</option>
                  <option value="replica">Replica</option>
                </select>
              </div>
              {browse.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-10 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  No merch listings yet.
                </p>
              ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {browse.map((m) => {
                  const pill = merchStatusPill(m.status);
                  const isOwn = user && m.sellerId === user.id;
                  const isLocked = m.status === "locked";
                  const isSold = m.status === "sold";
                  const canConnect = user && !isOwn && !isLocked && !isSold;
                  const myPending = canConnect ? myPendingMerchConnectionByListingId.get(m.id) : null;
                  const canReport = user && !isOwn && m.status !== "sold";
                  const firstImage = m.images?.[0];
                  return (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      className="rounded-2xl border border-army-purple/20 bg-white p-4 shadow-sm cursor-pointer transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-army-purple dark:border-army-purple/30 dark:bg-neutral-900/80"
                      onClick={() => setDetailListing(m)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailListing(m); } }}
                    >
                      {m.images && m.images.length > 0 ? (
                        <div
                          className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800"
                          onClick={(e) => { e.stopPropagation(); setLightboxImages(m.images!); setLightboxIndex(0); setLightboxSrc(m.images![0]); setLightboxOpen(true); }}
                        >
                          {m.images.length === 1 ? (
                            <Image src={m.images[0]} alt={m.title} fill className="object-cover" sizes="(max-width: 384px) 100vw, 33vw" unoptimized />
                          ) : (
                            <div className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                              {m.images.map((src, i) => (
                                <div key={i} className="relative h-full w-full flex-shrink-0 snap-center" onClick={(e) => { e.stopPropagation(); setLightboxImages(m.images!); setLightboxIndex(i); setLightboxSrc(src); setLightboxOpen(true); }}>
                                  <Image src={src} alt={`${m.title} ${i + 1}`} fill className="object-cover" sizes="(max-width: 384px) 100vw, 33vw" unoptimized />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-square w-full rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 text-sm">No image</div>
                      )}
                      <h3 className="mt-3 font-semibold text-army-purple line-clamp-2">{m.title}</h3>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Qty: {m.quantity} · {formatPrice(m.price, m.currency)}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill.cls}`}>{pill.label}</span>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {canReport && (
                            <button
                              type="button"
                              className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                              onClick={() => setReportOpen({ merchListingId: m.id, summary: m.title })}
                            >
                              Report
                            </button>
                          )}
                          {canConnect && (
                            <button
                              type="button"
                              className={myPending ? "rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20" : "rounded-lg bg-army-purple px-3 py-1.5 text-sm font-semibold text-white hover:bg-army-purple/90"}
                              onClick={() => {
                                setConnectListingId(m.id);
                                setConnectSummary(m.title);
                              }}
                            >
                              {myPending ? "Cancel request" : "Connect"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) }
            </>
          ) : tab === "connections" ? (
            connections.length === 0 ? (
              <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-10 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                No merch connections yet.
              </p>
            ) : (
              <div className="space-y-3">
                {connections.map((c) => {
                  const isFinished = ["ended", "expired", "declined"].includes(c.stage);
                  const cardTone = isFinished
                    ? "border-army-purple/10 bg-neutral-50 dark:border-army-purple/20 dark:bg-neutral-900/70"
                    : "border-army-purple/20 bg-army-purple/5 dark:border-army-purple/30 dark:bg-army-purple/15";
                  return (
                    <Link
                      key={c.id}
                      href={`/merch/connections/${c.id}`}
                      className={`relative block rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cardTone}`}
                    >
                      {unreadMerchConnectionIds.has(c.id) && (
                        <span
                          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-army-purple px-1 text-[10px] font-bold text-white"
                          aria-label={`${unreadMerchConnectionCountById.get(c.id) ?? 1} unread updates for this connection`}
                        >
                          {(unreadMerchConnectionCountById.get(c.id) ?? 1) > 99 ? "99+" : (unreadMerchConnectionCountById.get(c.id) ?? 1)}
                        </span>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-army-purple">Merch connection</span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">{c.stage.replace(/_/g, " ")}</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Listing ID: {c.merchListingId.slice(0, 8)}…</p>
                    </Link>
                  );
                })}
              </div>
            )
          ) : (
            <>
              {mine.length === 0 ? (
                <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-10 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
                  You haven’t posted any merch listings yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {mine.map((m) => {
                    const pill = merchStatusPill(m.status);
                    const firstImage = m.images?.[0];
                    const isSold = m.status === "sold";
                    const connectionCount = connections.filter((c) => c.merchListingId === m.id && !["ended", "expired", "declined"].includes(c.stage)).length;
                    return (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-army-purple/20 bg-white p-4 dark:border-army-purple/30 dark:bg-neutral-900/80"
                      >
                        <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                          {firstImage ? (
                            <button
                              type="button"
                              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-army-purple"
                              onClick={() => { setLightboxImages(m.images ?? null); setLightboxIndex(0); setLightboxSrc(firstImage); setLightboxOpen(true); }}
                            >
                              <Image src={firstImage} alt={m.title} fill className="object-cover" sizes="80px" unoptimized />
                            </button>
                          ) : (
                            <div className="h-20 w-20 shrink-0 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 text-xs">No image</div>
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <h3 className="font-semibold text-army-purple break-words">{m.title}</h3>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">Qty: {m.quantity} · {formatPrice(m.price, m.currency)}</p>
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${pill.cls}`}>{pill.label}</span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-army-purple/10 pt-3 dark:border-army-purple/20">
                          {connectionCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setTab("connections")}
                              className="rounded-lg border-2 border-army-purple/40 bg-transparent px-3 py-1.5 text-sm font-semibold text-army-purple hover:bg-army-purple/10 dark:border-army-purple/60 dark:text-army-300 dark:hover:bg-army-purple/20"
                            >
                              Connections ({connectionCount})
                            </button>
                          )}
                          {!isSold && (
                            <button
                              type="button"
                              onClick={() => handleMarkSold(m)}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-army-600 hover:bg-army-200/40 dark:text-army-400 dark:hover:bg-army-800/30"
                            >
                              Mark sold
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setEditListing(m); setPostOpen(true); }}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-army-purple hover:bg-army-purple/10 dark:hover:bg-army-purple/20"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(m)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Post Merch modal */}
      {postOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!postSubmitting) { resetPostFlow(); setEditListing(null); setPostOpen(false); } }}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900 dark:border-army-purple/30" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-army-purple">{editListing ? "Edit listing" : "Post Merch Listing"}</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium">Category *</label>
              <select value={postCategorySlug} onChange={(e) => { setPostCategorySlug(e.target.value); setPostSubcategorySlug(""); }} className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800">
                {categories.filter((c) => !c.parentSlug).map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
                {categories.length === 0 && <option value="other">Other</option>}
              </select>
              {postCategorySlug && categories.some((c) => c.parentSlug === postCategorySlug) && (
                <>
                  <label className="block text-sm font-medium">Subcategory</label>
                  <select value={postSubcategorySlug} onChange={(e) => setPostSubcategorySlug(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800">
                    <option value="">—</option>
                    {categories.filter((c) => c.parentSlug === postCategorySlug).map((c) => (
                      <option key={c.slug} value={c.slug}>{c.label}</option>
                    ))}
                  </select>
                </>
              )}
              <label className="block text-sm font-medium">Collection / Event *</label>
              <select value={postCollectionEvent} onChange={(e) => setPostCollectionEvent(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" required>
                {MERCH_COLLECTION_EVENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={postIsFanmade} onChange={(e) => { setPostIsFanmade(e.target.checked); if (!e.target.checked) setPostFanmadeDisclaimerAccepted(false); }} />
                <span className="text-sm font-medium">This is fanmade merch (not official BTS)</span>
              </label>
              {postIsFanmade && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">This is fanmade and not official BTS merch.</p>
                  <label className="mt-2 flex items-center gap-2">
                    <input type="checkbox" checked={postFanmadeDisclaimerAccepted} onChange={(e) => setPostFanmadeDisclaimerAccepted(e.target.checked)} />
                    <span className="text-sm">I confirm this is fanmade and not official BTS merch.</span>
                  </label>
                </div>
              )}
              <label className="block text-sm font-medium">Title *</label>
              <input type="text" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" placeholder="e.g. Proof album" />
              <label className="block text-sm font-medium">Description</label>
              <textarea value={postDescription} onChange={(e) => setPostDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" placeholder="Condition, details..." />
              <label className="block text-sm font-medium">Quantity *</label>
              <input type="number" min={1} value={postQuantity} onChange={(e) => setPostQuantity(parseInt(e.target.value, 10) || 1)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" />
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Size (optional)</label>
                  <input type="text" value={postSize} onChange={(e) => setPostSize(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" placeholder="e.g. M, One size" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Color (optional)</label>
                  <input type="text" value={postColor} onChange={(e) => setPostColor(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" placeholder="e.g. Black, Navy" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div>
                  <label className="block text-sm font-medium">Price *</label>
                  <input type="text" inputMode="decimal" value={postPrice} onChange={(e) => setPostPrice(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" placeholder="0.00" />
                </div>
                <div className="pt-7">
                  <select value={postCurrency} onChange={(e) => setPostCurrency(e.target.value)} className="h-[42px] w-full min-w-[6rem] rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 sm:w-auto">
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-army-purple/80">Optional filters</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">This will help users find your items quickly.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Sealed / Opened</label>
                  <select value={postFilterSealed} onChange={(e) => setPostFilterSealed(e.target.value)} className="mt-0.5 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                    <option value="">—</option>
                    <option value="sealed">Sealed</option>
                    <option value="opened">Opened</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Member</label>
                  <select value={postFilterMember} onChange={(e) => setPostFilterMember(e.target.value)} className="mt-0.5 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                    <option value="">—</option>
                    <option value="RM">RM</option>
                    <option value="Jin">Jin</option>
                    <option value="SUGA">SUGA</option>
                    <option value="j-hope">j-hope</option>
                    <option value="Jimin">Jimin</option>
                    <option value="V">V</option>
                    <option value="Jungkook">Jungkook</option>
                    <option value="OT7">OT7</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Tour</label>
                  <select value={postFilterTour} onChange={(e) => setPostFilterTour(e.target.value)} className="mt-0.5 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                    {MERCH_TOUR_OPTIONS.map((o) => (
                      <option key={o.value || "none"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Condition</label>
                  <select value={postFilterCondition} onChange={(e) => setPostFilterCondition(e.target.value)} className="mt-0.5 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                    <option value="">—</option>
                    <option value="like_new">Like new</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="used">Used</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Official / Replica</label>
                  <select value={postFilterOfficialReplica} onChange={(e) => setPostFilterOfficialReplica(e.target.value)} className="mt-0.5 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                    <option value="">—</option>
                    <option value="official">Official</option>
                    <option value="replica">Replica</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Version (e.g. album version)</label>
                  <input type="text" value={postFilterVersion} onChange={(e) => setPostFilterVersion(e.target.value)} className="mt-0.5 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800" placeholder="e.g. Version A" />
                </div>
              </div>
              <p className="text-sm font-medium">Photos (optional, up to 2)</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">If you have a pic of your item add it here to build trust with the users.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Photo 1</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="w-full text-sm text-neutral-600 file:mr-2 file:rounded-lg file:border-0 file:bg-army-purple file:px-3 file:py-1.5 file:text-white file:text-sm dark:text-neutral-400"
                    onChange={(e) => setPostImage1(e.target.files?.[0] ?? null)}
                  />
                  {postImage1 && <p className="mt-1 text-xs text-neutral-500 truncate">{postImage1.name}</p>}
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Photo 2</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="w-full text-sm text-neutral-600 file:mr-2 file:rounded-lg file:border-0 file:bg-army-purple file:px-3 file:py-1.5 file:text-white file:text-sm dark:text-neutral-400"
                    onChange={(e) => setPostImage2(e.target.files?.[0] ?? null)}
                  />
                  {postImage2 && <p className="mt-1 text-xs text-neutral-500 truncate">{postImage2.name}</p>}
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600" onClick={() => { if (!postSubmitting) { resetPostFlow(); setEditListing(null); setPostOpen(false); } }} disabled={postSubmitting}>Cancel</button>
              {editListing ? (
                <button type="button" className="btn-army" onClick={() => void handleEditSubmit()} disabled={postSubmitting}>{postSubmitting ? "Updating…" : "Update listing"}</button>
              ) : (
                <button type="button" className="btn-army" onClick={handlePostSubmit} disabled={postSubmitting}>{postSubmitting ? "Posting…" : "Continue"}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showBondingModal && bondingPrompts.length >= 2 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowBondingModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-army-purple">Build trust with buyers</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Answer these 2 questions once. Your answers will be shown to buyers when they connect to your listings.
            </p>
            <div className="mt-4 space-y-3">
              {bondingPrompts.map((q) => (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-army-purple">{q.prompt}</label>
                  <textarea
                    className="mt-1 w-full min-h-[80px] rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
                    value={bondingAnswers[q.id] ?? ""}
                    onChange={(e) => setBondingAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Your answer…"
                  />
                </div>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600" onClick={() => setShowBondingModal(false)} disabled={bondingSubmitting}>Cancel</button>
              <button type="button" className="btn-army" onClick={() => void submitBondingThenSocials()} disabled={bondingSubmitting}>{bondingSubmitting ? "Saving…" : "Save & continue"}</button>
            </div>
          </div>
        </div>
      )}

      {showSocialsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSocialsModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900 dark:border-army-purple/25" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-army-purple">Before your listing goes live</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Are you comfortable sharing your socials (Instagram or Facebook) with buyers who connect to this listing?
            </p>
            <div className="mt-4 flex gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="merch-seller-socials" checked={sellerComfortableSocials === true} onChange={() => setSellerComfortableSocials(true)} />
                <span>Yes</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="merch-seller-socials" checked={sellerComfortableSocials === false} onChange={() => setSellerComfortableSocials(false)} />
                <span>No</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600" onClick={() => setShowSocialsModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn-army"
                onClick={() => { setShowSocialsModal(false); setShowSafetyModal(true); }}
                disabled={sellerComfortableSocials === null}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showSafetyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSafetyModal(false)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900 dark:border-army-purple/25" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-army-purple">Warnings &amp; safety</h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Please read and confirm before your listing goes live.</p>
            <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-4 rounded-xl border border-army-purple/15 p-4 text-sm text-neutral-800 dark:border-army-purple/25 dark:bg-neutral-900/60 dark:text-neutral-200">
              <p className="font-semibold text-army-purple">Before you list</p>
              <p>This platform is only here to help ARMYs connect. We do not verify merch, identities, or payments. You list at your own discretion.</p>
              <hr className="border-army-purple/15 dark:border-army-purple/25" />
              <p className="font-semibold text-army-purple">Face value only</p>
              <p>Only <strong>face value</strong> is accepted. By listing, you agree to sell at face value only. Listing above face value can lead to reports and a ban.</p>
              <hr className="border-army-purple/15 dark:border-army-purple/25" />
              <p className="font-semibold text-army-purple">By posting, you confirm:</p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={safetyAck1} onChange={(e) => setSafetyAck1(e.target.checked)} />
                  <span>I understand the admins do not verify merch, handle payments, or take responsibility for transactions.</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={safetyAck2} onChange={(e) => setSafetyAck2(e.target.checked)} />
                  <span>I choose to list at my own discretion.</span>
                </label>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600" onClick={() => setShowSafetyModal(false)} disabled={postSubmitting}>Back</button>
              <button type="button" className="btn-army" onClick={() => void doCreateMerchListing()} disabled={postSubmitting || !safetyAck1 || !safetyAck2}>
                {postSubmitting ? "Posting…" : "Post listing"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect to merch modal */}
      {detailListing && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setDetailListing(null)}>
          <div className="my-8 w-full max-w-lg rounded-2xl border border-army-purple/20 bg-white shadow-xl dark:bg-neutral-900 dark:border-army-purple/25" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-bold text-army-purple">{detailListing.title}</h3>
                <button type="button" className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setDetailListing(null)} aria-label="Close">×</button>
              </div>
              {detailListing.images && detailListing.images.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  <div className="flex snap-x snap-mandatory gap-0 overflow-x-auto overscroll-x-contain scroll-smooth pb-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                    {detailListing.images.map((src, i) => (
                      <button key={i} type="button" className="relative h-48 min-w-full shrink-0 snap-center overflow-hidden md:h-56" onClick={() => { setLightboxImages(detailListing.images!); setLightboxIndex(i); setLightboxSrc(src); setLightboxOpen(true); setDetailListing(null); }}>
                        <Image src={src} alt={`${detailListing.title} ${i + 1}`} fill className="object-contain" sizes="(max-width: 512px) 100vw, 512px" unoptimized />
                      </button>
                    ))}
                  </div>
                  {detailListing.images.length > 1 && (
                    <p className="py-1 text-center text-xs text-neutral-500 dark:text-neutral-400">Swipe to see more photos</p>
                  )}
                </div>
              ) : (
                <div className="mt-4 h-40 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 text-sm">No image</div>
              )}
              <p className="mt-4 text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{detailListing.description || "—"}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-neutral-500 dark:text-neutral-400">Quantity</dt>
                <dd className="font-medium">{detailListing.quantity}</dd>
                <dt className="text-neutral-500 dark:text-neutral-400">Price</dt>
                <dd className="font-medium">{formatPrice(detailListing.price, detailListing.currency)}</dd>
                <dt className="text-neutral-500 dark:text-neutral-400">Status</dt>
                <dd><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${merchStatusPill(detailListing.status).cls}`}>{merchStatusPill(detailListing.status).label}</span></dd>
                {detailListing.filterOptions && typeof detailListing.filterOptions === "object" && Object.entries(detailListing.filterOptions).map(([key, val]) => (val != null && String(val).trim() !== "" ? (
                  <span key={key} className="contents">
                    <dt className="text-neutral-500 dark:text-neutral-400">{formatFilterOptionKey(key)}</dt>
                    <dd className="font-medium">{String(val)}</dd>
                  </span>
                ) : null))}
              </dl>
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600" onClick={() => setDetailListing(null)}>Close</button>
                {user && detailListing.sellerId !== user.id && detailListing.status !== "sold" && detailListing.status !== "locked" && (
                  <button
                    type="button"
                    className={myPendingMerchConnectionByListingId.has(detailListing.id) ? "rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20" : "rounded-lg bg-army-purple px-4 py-2 text-sm font-semibold text-white hover:bg-army-purple/90"}
                    onClick={() => { setConnectListingId(detailListing.id); setConnectSummary(detailListing.title); setDetailListing(null); }}
                  >
                    {myPendingMerchConnectionByListingId.has(detailListing.id) ? "Cancel request" : "Connect"}
                  </button>
                )}
                {user && detailListing.sellerId !== user.id && detailListing.status !== "sold" && (
                  <button
                    type="button"
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                    onClick={() => { setReportOpen({ merchListingId: detailListing.id, summary: detailListing.title }); setDetailListing(null); }}
                  >
                    Report
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {connectListingId && (() => {
        const pendingConnection = user ? connections.find((c) => c.merchListingId === connectListingId && c.buyerId === user.id && c.stage === "pending_seller") : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !connectSubmitting && setConnectListingId(null)}>
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900 dark:border-army-purple/30" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-army-purple">Connect to: {connectSummary}</h3>
              {pendingConnection ? (
                <>
                  <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">You have a pending request. The seller has up to 24 hours to accept or decline.</p>
                  <div className="mt-6 flex gap-2 justify-end">
                    <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600" onClick={() => setConnectListingId(null)} disabled={connectSubmitting}>Close</button>
                    <button
                      type="button"
                      className="btn-army-outline text-red-600 border-red-300 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                      onClick={async () => {
                        setConnectSubmitting(true);
                        setConnectError(null);
                        const { error: e } = await endMerchConnection(pendingConnection.id);
                        setConnectSubmitting(false);
                        if (e) setConnectError(e);
                        else { await load(); setConnectListingId(null); }
                      }}
                      disabled={connectSubmitting}
                    >
                      {connectSubmitting ? "Cancelling…" : "Cancel request"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {connectSellerProfile.loading && <p className="mt-2 text-sm text-neutral-500">Loading seller…</p>}
                  {connectSellerProfile.error && <p className="mt-2 text-sm text-red-600">{connectSellerProfile.error}</p>}
                  {connectSellerProfile.data && (
                    <>
                      <div className="mt-4 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <p className="text-sm font-semibold text-army-purple">Seller profile</p>
                        <div className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <p><span className="font-medium text-army-purple">Username:</span> {connectSellerProfile.data.username}</p>
                          {connectSellerProfile.data.country && <p><span className="font-medium text-army-purple">Country:</span> {connectSellerProfile.data.country}</p>}
                          <p><span className="font-medium text-army-purple">Price:</span> {connectSellerProfile.data.priceExplanation}</p>
                          {connectSellerProfile.data.sellingReason && <p><span className="font-medium text-army-purple">Why selling:</span> {connectSellerProfile.data.sellingReason}</p>}
                          {(connectSellerProfile.data.armyBiasAnswer || connectSellerProfile.data.armyYearsArmy || connectSellerProfile.data.armyFavoriteAlbum) && (
                            <div className="mt-2 space-y-1">
                              <p className="font-medium text-army-purple">ARMY profile</p>
                              {connectSellerProfile.data.armyBiasAnswer && <div><p className="text-xs text-army-purple/80">{connectSellerProfile.data.armyBiasPrompt}</p><p className="whitespace-pre-wrap">{connectSellerProfile.data.armyBiasAnswer}</p></div>}
                              {connectSellerProfile.data.armyYearsArmy && <div><p className="text-xs text-army-purple/80">{connectSellerProfile.data.armyYearsArmyPrompt}</p><p className="whitespace-pre-wrap">{connectSellerProfile.data.armyYearsArmy}</p></div>}
                              {connectSellerProfile.data.armyFavoriteAlbum && <div><p className="text-xs text-army-purple/80">{connectSellerProfile.data.armyFavoriteAlbumPrompt}</p><p className="whitespace-pre-wrap">{connectSellerProfile.data.armyFavoriteAlbum}</p></div>}
                            </div>
                          )}
                          {connectSellerProfile.data.bondingAnswers.filter((b) => b.prompt || b.answer).length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="font-medium text-army-purple">Bonding answers:</p>
                              {connectSellerProfile.data.bondingAnswers.map((b, idx) => (
                                <div key={idx}><p className="text-xs text-army-purple/80">{b.prompt}</p><p className="whitespace-pre-wrap">{b.answer || "—"}</p></div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-army-purple">Do you want to share your socials with this seller?</p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">If you both agree later, you’ll see each other’s socials in the match message.</p>
                        <div className="mt-2 flex gap-4">
                          <label className="flex items-center gap-2"><input type="radio" name="merchSocial" checked={connectSocialShare === true} onChange={() => setConnectSocialShare(true)} /> Yes</label>
                          <label className="flex items-center gap-2"><input type="radio" name="merchSocial" checked={connectSocialShare === false} onChange={() => setConnectSocialShare(false)} /> No</label>
                        </div>
                      </div>
                      {connectHasBonding === false && connectQuestionIds.length >= 2 && (
                        <div className="mt-4 space-y-3">
                          <p className="text-sm font-semibold text-army-purple">Answer these 2 questions to build trust with the seller</p>
                          {connectQuestionIds.map((qid) => (
                            <div key={qid}>
                              <label className="block text-sm text-neutral-700 dark:text-neutral-300">{connectBondingPrompts.find((p) => p.id === qid)?.prompt ?? "Question"}</label>
                              <textarea className="mt-1 w-full min-h-[80px] rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" value={connectBondingAnswers[qid] ?? ""} onChange={(e) => setConnectBondingAnswers((prev) => ({ ...prev, [qid]: e.target.value }))} placeholder="Your answer…" />
                            </div>
                          ))}
                        </div>
                      )}
                      {connectError && <p className="mt-2 text-sm text-red-600">{connectError}</p>}
                      <div className="mt-6 flex gap-2 justify-end">
                        <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600" onClick={() => !connectSubmitting && setConnectListingId(null)} disabled={connectSubmitting}>Cancel</button>
                        <button type="button" className="btn-army" onClick={handleConnectSubmit} disabled={connectSubmitting}>{connectSubmitting ? "Connecting…" : "Send request"}</button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      <ImageLightbox src={lightboxSrc} alt="" open={lightboxOpen} onClose={() => setLightboxOpen(false)} images={lightboxImages ?? undefined} initialIndex={lightboxIndex} />

      <MerchListingReportModal
        open={!!reportOpen}
        onClose={() => setReportOpen(null)}
        listing={reportOpen ? { merchListingId: reportOpen.merchListingId, summary: reportOpen.summary } : null}
        onReported={() => { setError(null); load(); }}
      />

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="merch-delete-confirm-title"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900 dark:border-army-purple/30"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="merch-delete-confirm-title" className="font-display text-lg font-bold text-army-purple">
              Delete listing?
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {deleteConfirm.title}. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-army-outline">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
