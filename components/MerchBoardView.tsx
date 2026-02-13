"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import ImageLightbox from "@/components/ImageLightbox";
import MerchListingReportModal from "@/components/MerchListingReportModal";
import { useAuth } from "@/lib/AuthContext";
import {
  fetchBrowseMerchListings,
  fetchMerchCategories,
  fetchMyMerchListings,
  fetchMyMerchConnections,
  createMerchListing,
  connectToMerchListingV2,
  fetchMerchListingSellerProfileForConnect,
  getConnectionBondingQuestionIds,
  type MerchCategory,
  type MerchListingCard,
  type MyMerchListing,
  type MerchConnectionRow,
  type MerchSellerProfileForConnect,
} from "@/lib/supabase/merch";
import { CURRENCY_OPTIONS } from "@/lib/data/currencies";
import { hasUserBondingAnswers } from "@/lib/supabase/listings";
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
  { value: "run_bts", label: "Run BTS" },
  { value: "bon_voyage", label: "Bon Voyage" },
  { value: "in_the_soop", label: "In the SOOP" },
  { value: "festa", label: "Festa" },
  { value: "muster", label: "Muster" },
  { value: "seasons_greetings", label: "Season's Greetings" },
  { value: "memories", label: "Memories" },
  { value: "popup_store", label: "Pop-up Store" },
  { value: "artist_made", label: "Artist Made Collection" },
  { value: "tour_name", label: "Tour name (LY, SY, PTD, D-DAY, FACE, GOLDEN etc.)" },
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

  const [connectListingId, setConnectListingId] = useState<string | null>(null);
  const [connectSummary, setConnectSummary] = useState("");
  const [connectSellerProfile, setConnectSellerProfile] = useState<{ data: MerchSellerProfileForConnect | null; loading: boolean; error: string | null }>({ data: null, loading: false, error: null });
  const [connectSocialShare, setConnectSocialShare] = useState<boolean | null>(null);
  const [connectBondingAnswers, setConnectBondingAnswers] = useState<Record<string, string>>({});
  const [connectQuestionIds, setConnectQuestionIds] = useState<string[]>([]);
  const [connectHasBonding, setConnectHasBonding] = useState<boolean | null>(null);
  const [connectSubmitting, setConnectSubmitting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState("");
  const [reportOpen, setReportOpen] = useState<{ merchListingId: string; summary: string } | null>(null);

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
      if (qRes.data?.length === 2) setConnectQuestionIds(qRes.data);
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
    if (user?.id) {
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

    const { listingId, error: e } = await createMerchListing({
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
    });
    setPostSubmitting(false);
    if (e) {
      setError(e);
      return;
    }
    setPostOpen(false);
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
    await load();
    if (listingId) setTab("my");
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
          <button type="button" className="btn-army" title="Post a merch listing" onClick={() => setPostOpen(true)}>
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
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === "connections" ? "bg-army-purple text-white" : "text-army-purple hover:bg-army-purple/10"
            }`}
            onClick={() => setTab("connections")}
          >
            My Connections
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
                  const canReport = user && !isOwn && m.status !== "sold";
                  const firstImage = m.images?.[0];
                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-army-purple/20 bg-white p-4 shadow-sm dark:border-army-purple/30 dark:bg-neutral-900/80"
                    >
                      {firstImage ? (
                        <button
                          type="button"
                          className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-army-purple block"
                          onClick={() => { setLightboxSrc(firstImage); setLightboxOpen(true); }}
                        >
                          <Image src={firstImage} alt={m.title} fill className="object-cover" sizes="(max-width: 384px) 100vw, 33vw" unoptimized />
                        </button>
                      ) : (
                        <div className="aspect-square w-full rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 text-sm">No image</div>
                      )}
                      <h3 className="mt-3 font-semibold text-army-purple line-clamp-2">{m.title}</h3>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Qty: {m.quantity} · {formatPrice(m.price, m.currency)}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill.cls}`}>{pill.label}</span>
                        <div className="flex gap-2">
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
                              className="rounded-lg bg-army-purple px-3 py-1.5 text-sm font-semibold text-white hover:bg-army-purple/90"
                              onClick={() => {
                                setConnectListingId(m.id);
                                setConnectSummary(m.title);
                              }}
                            >
                              Connect
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
                      className={`block rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cardTone}`}
                    >
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
                    return (
                      <div
                        key={m.id}
                        className="flex flex-wrap items-center gap-4 rounded-2xl border border-army-purple/20 bg-white p-4 dark:border-army-purple/30 dark:bg-neutral-900/80"
                      >
                        {firstImage ? (
                          <button
                            type="button"
                            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-army-purple"
                            onClick={() => { setLightboxSrc(firstImage); setLightboxOpen(true); }}
                          >
                            <Image src={firstImage} alt={m.title} fill className="object-cover" sizes="80px" unoptimized />
                          </button>
                        ) : (
                          <div className="h-20 w-20 shrink-0 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 text-xs">No image</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-army-purple">{m.title}</h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">Qty: {m.quantity} · {formatPrice(m.price, m.currency)}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${pill.cls}`}>{pill.label}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !postSubmitting && setPostOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900 dark:border-army-purple/30" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-army-purple">Post Merch Listing</h3>
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
              <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 dark:border-neutral-600" onClick={() => !postSubmitting && setPostOpen(false)} disabled={postSubmitting}>Cancel</button>
              <button type="button" className="btn-army" onClick={handlePostSubmit} disabled={postSubmitting}>{postSubmitting ? "Posting…" : "Post"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Connect to merch modal */}
      {connectListingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !connectSubmitting && setConnectListingId(null)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900 dark:border-army-purple/30" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-army-purple">Connect to: {connectSummary}</h3>
            {connectSellerProfile.loading && <p className="mt-2 text-sm text-neutral-500">Loading seller…</p>}
            {connectSellerProfile.error && <p className="mt-2 text-sm text-red-600">{connectSellerProfile.error}</p>}
            {connectSellerProfile.data && (
              <>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Seller: {connectSellerProfile.data.username}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Price: {connectSellerProfile.data.priceExplanation}</p>
                <div className="mt-4">
                  <p className="text-sm font-medium">Share your socials with this seller?</p>
                  <div className="mt-2 flex gap-4">
                    <label className="flex items-center gap-2"><input type="radio" name="merchSocial" checked={connectSocialShare === true} onChange={() => setConnectSocialShare(true)} /> Yes</label>
                    <label className="flex items-center gap-2"><input type="radio" name="merchSocial" checked={connectSocialShare === false} onChange={() => setConnectSocialShare(false)} /> No</label>
                  </div>
                </div>
                {connectHasBonding === false && connectQuestionIds.length >= 2 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Bonding questions</p>
                    {connectQuestionIds.map((qid) => (
                      <div key={qid}>
                        <label className="block text-xs text-neutral-500">Answer</label>
                        <input type="text" value={connectBondingAnswers[qid] ?? ""} onChange={(e) => setConnectBondingAnswers((prev) => ({ ...prev, [qid]: e.target.value }))} className="w-full rounded border px-2 py-1 text-sm dark:bg-neutral-800" />
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
          </div>
        </div>
      )}

      <ImageLightbox src={lightboxSrc} alt="" open={lightboxOpen} onClose={() => setLightboxOpen(false)} />

      <MerchListingReportModal
        open={!!reportOpen}
        onClose={() => setReportOpen(null)}
        listing={reportOpen ? { merchListingId: reportOpen.merchListingId, summary: reportOpen.summary } : null}
        onReported={() => { setError(null); load(); }}
      />
    </RequireAuth>
  );
}
