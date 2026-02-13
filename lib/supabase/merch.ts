import { supabase } from "@/lib/supabaseClient";
import { getConnectionBondingQuestionIds } from "@/lib/supabase/listings";

export type MerchCategory = {
  slug: string;
  label: string;
  parentSlug: string | null;
  sortOrder: number;
};

export type MerchListingCard = {
  id: string;
  sellerId: string;
  title: string;
  description: string | null;
  quantity: number;
  price: number;
  currency: string;
  images: string[];
  status: string;
  createdAt: string;
  categorySlug?: string;
  subcategorySlug?: string | null;
  isFanmade?: boolean;
  filterOptions?: Record<string, unknown>;
};

export type MyMerchListing = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  price: number;
  currency: string;
  images: string[];
  status: string;
  createdAt: string;
};

export type MerchConnectionRow = {
  id: string;
  stage: string;
  stageExpiresAt: string;
  merchListingId: string;
  buyerId: string;
  sellerId: string;
  endedBy: string | null;
  endedAt: string | null;
};

export type MerchSellerProfileForConnect = {
  username: string;
  country: string;
  armyBiasPrompt: string;
  armyBiasAnswer: string;
  armyYearsArmyPrompt: string;
  armyYearsArmy: string;
  armyFavoriteAlbumPrompt: string;
  armyFavoriteAlbum: string;
  ticketSource: string;
  ticketingExperience: string;
  sellingReason: string;
  priceExplanation: string;
  bondingAnswers: Array<{ prompt: string; answer: string }>;
};

function parseMerchSellerProfile(r: any): MerchSellerProfileForConnect {
  const rawBonding = Array.isArray(r?.bondingAnswers) ? r.bondingAnswers : [];
  return {
    username: String(r?.username ?? "Seller"),
    country: String(r?.country ?? ""),
    armyBiasPrompt: String(r?.armyBiasPrompt ?? "Bias"),
    armyBiasAnswer: String(r?.armyBiasAnswer ?? ""),
    armyYearsArmyPrompt: String(r?.armyYearsArmyPrompt ?? "Years ARMY"),
    armyYearsArmy: String(r?.armyYearsArmy ?? ""),
    armyFavoriteAlbumPrompt: String(r?.armyFavoriteAlbumPrompt ?? "Favorite album"),
    armyFavoriteAlbum: String(r?.armyFavoriteAlbum ?? ""),
    ticketSource: String(r?.ticketSource ?? ""),
    ticketingExperience: String(r?.ticketingExperience ?? ""),
    sellingReason: String(r?.sellingReason ?? ""),
    priceExplanation: String(r?.priceExplanation ?? ""),
    bondingAnswers: rawBonding.map((b: any) => ({
      prompt: String(b?.prompt ?? ""),
      answer: String(b?.answer ?? ""),
    })),
  };
}

export async function fetchMerchCategories(): Promise<{
  data: MerchCategory[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("get_merch_categories");
  if (error) return { data: [], error: error.message };
  const rows = Array.isArray(data) ? data : [];
  return {
    data: rows.map((r: any) => ({
      slug: String(r.slug ?? ""),
      label: String(r.label ?? ""),
      parentSlug: r.parent_slug != null ? String(r.parent_slug) : null,
      sortOrder: Number(r.sort_order ?? 0),
    })),
    error: null,
  };
}

export async function fetchBrowseMerchListings(filters?: {
  categorySlug?: string | null;
  subcategorySlug?: string | null;
  filterSealed?: string | null;
  filterMember?: string | null;
  filterTour?: string | null;
  filterCondition?: string | null;
  filterOfficialReplica?: string | null;
  filterCollectionEvent?: string | null;
}): Promise<{
  data: MerchListingCard[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("browse_merch_listings", {
    p_category_slug: filters?.categorySlug ?? null,
    p_subcategory_slug: filters?.subcategorySlug ?? null,
    p_filter_sealed: filters?.filterSealed ?? null,
    p_filter_member: filters?.filterMember ?? null,
    p_filter_tour: filters?.filterTour ?? null,
    p_filter_condition: filters?.filterCondition ?? null,
    p_filter_official_replica: filters?.filterOfficialReplica ?? null,
    p_filter_collection_event: filters?.filterCollectionEvent ?? null,
  });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      sellerId: String(r.seller_id),
      title: String(r.title ?? ""),
      description: r.description != null ? String(r.description) : null,
      quantity: Number(r.quantity ?? 1),
      price: Number(r.price ?? 0),
      currency: String(r.currency ?? "USD"),
      images: Array.isArray(r.images) ? r.images.map((x: any) => String(x)) : [],
      status: String(r.status ?? "active"),
      createdAt: String(r.created_at ?? ""),
      categorySlug: r.category_slug != null ? String(r.category_slug) : undefined,
      subcategorySlug: r.subcategory_slug != null ? String(r.subcategory_slug) : null,
      isFanmade: r.is_fanmade === true,
      filterOptions: typeof r.filter_options === "object" && r.filter_options !== null ? r.filter_options : undefined,
    })),
    error: null,
  };
}

export async function fetchMyMerchListings(userId: string): Promise<{
  data: MyMerchListing[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("merch_listings")
    .select("id, title, description, quantity, price, currency, images, status, created_at")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      description: r.description != null ? String(r.description) : null,
      quantity: Number(r.quantity ?? 1),
      price: Number(r.price ?? 0),
      currency: String(r.currency ?? "USD"),
      images: Array.isArray(r.images) ? r.images.map((x: any) => String(x)) : [],
      status: String(r.status ?? "active"),
      createdAt: String(r.created_at ?? ""),
    })),
    error: null,
  };
}

export async function fetchMyMerchConnections(userId: string): Promise<{
  data: MerchConnectionRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("merch_connections")
    .select("id, stage, stage_expires_at, merch_listing_id, buyer_id, seller_id, ended_by, ended_at")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      stage: String(r.stage ?? ""),
      stageExpiresAt: String(r.stage_expires_at ?? ""),
      merchListingId: String(r.merch_listing_id),
      buyerId: String(r.buyer_id),
      sellerId: String(r.seller_id),
      endedBy: r.ended_by ? String(r.ended_by) : null,
      endedAt: r.ended_at ? String(r.ended_at) : null,
    })),
    error: null,
  };
}

export async function createMerchListing(params: {
  title: string;
  description?: string;
  quantity: number;
  price: number;
  currency?: string;
  images?: string[];
  categorySlug?: string;
  subcategorySlug?: string | null;
  isFanmade?: boolean;
  fanmadeDisclaimerAccepted?: boolean;
  filterOptions?: Record<string, unknown>;
  proofUrl?: string | null;
}): Promise<{ listingId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_merch_listing", {
    p_title: params.title.trim(),
    p_description: params.description?.trim() ?? "",
    p_quantity: params.quantity,
    p_price: params.price,
    p_currency: params.currency ?? "USD",
    p_images: params.images ?? [],
    p_category_slug: params.categorySlug ?? "other",
    p_subcategory_slug: params.subcategorySlug ?? null,
    p_is_fanmade: params.isFanmade ?? false,
    p_fanmade_disclaimer_accepted: params.fanmadeDisclaimerAccepted ?? false,
    p_filter_options: params.filterOptions ?? {},
    p_proof_url: params.proofUrl ?? null,
  });
  if (error) return { listingId: null, error: error.message };
  return { listingId: String(data ?? ""), error: null };
}

export async function fetchMerchListingSellerProfileForConnect(
  merchListingId: string
): Promise<{ data: MerchSellerProfileForConnect | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_merch_listing_seller_profile_for_connect", {
    p_merch_listing_id: merchListingId,
  });
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: parseMerchSellerProfile(data), error: null };
}

export async function fetchMerchConnectionBuyerProfileForSeller(
  connectionId: string
): Promise<{ data: MerchSellerProfileForConnect | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_merch_connection_buyer_profile_for_seller", {
    p_connection_id: connectionId,
  });
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: parseMerchSellerProfile(data), error: null };
}

export async function connectToMerchListingV2(
  merchListingId: string,
  wantSocialShare: boolean,
  bondingAnswers?: Record<string, string> | null,
  questionIds?: string[] | null
): Promise<{ connectionId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("connect_to_merch_listing_v2", {
    p_merch_listing_id: merchListingId,
    p_want_social_share: wantSocialShare,
    p_bonding_answers: bondingAnswers ?? null,
    p_question_ids: questionIds && questionIds.length === 2 ? questionIds : null,
  });
  if (error) return { connectionId: null, error: error.message };
  return { connectionId: String(data ?? ""), error: null };
}

export async function sellerRespondMerchConnection(
  connectionId: string,
  accept: boolean,
  sellerSocialShare?: boolean | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("seller_respond_merch_connection", {
    p_connection_id: connectionId,
    p_accept: accept,
    p_seller_social_share: accept ? sellerSocialShare ?? null : null,
  });
  return { error: error?.message ?? null };
}

export async function endMerchConnection(connectionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("end_merch_connection", {
    p_connection_id: connectionId,
    p_ended_reason: null,
  });
  return { error: error?.message ?? null };
}

export async function getMerchConnectionPreview(connectionId: string): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase.rpc("get_merch_connection_preview", { p_connection_id: connectionId });
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function submitMerchBondingAnswers(connectionId: string, answers: Record<string, string>): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("submit_merch_bonding_answers", { p_connection_id: connectionId, p_answers: answers });
  return { error: error?.message ?? null };
}

export async function setMerchComfortDecision(connectionId: string, comfort: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_merch_comfort_decision", { p_connection_id: connectionId, p_comfort: comfort });
  return { error: error?.message ?? null };
}

export async function setMerchSocialShareDecision(connectionId: string, share: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_merch_social_share_decision", { p_connection_id: connectionId, p_share: share });
  return { error: error?.message ?? null };
}

export async function acceptMerchConnectionAgreement(connectionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("accept_merch_connection_agreement", { p_connection_id: connectionId });
  return { error: error?.message ?? null };
}

export { getConnectionBondingQuestionIds } from "@/lib/supabase/listings";
