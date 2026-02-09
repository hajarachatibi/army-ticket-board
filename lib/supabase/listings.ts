import { supabase } from "@/lib/supabaseClient";

export type BrowseListingSeat = {
  section: string;
  seatRow: string;
  seat: string;
  faceValuePrice: number;
  currency: string;
};

export type BrowseListingCard = {
  listingId: string;
  concertCity: string;
  concertDate: string;
  status: "processing" | "active" | "locked" | "sold" | "removed" | string;
  lockExpiresAt: string | null;
  vip: boolean;
  loge: boolean;
  suite: boolean;
  /** Number of seats (1–4) in this listing. */
  quantity: number;
  /** All seats in this listing (section, row, seat, face value). */
  seats: BrowseListingSeat[];
};

export type MyListing = {
  id: string;
  concertCity: string;
  concertDate: string;
  ticketSource: string;
  ticketingExperience: string;
  sellingReason: string;
  priceExplanation?: string | null;
  vip: boolean;
  loge: boolean;
  suite: boolean;
  status: "processing" | "active" | "locked" | "sold" | "removed";
  processingUntil: string;
  lockedBy: string | null;
  lockExpiresAt: string | null;
  createdAt: string;
  seats: Array<{
    seatIndex: number;
    section: string;
    seatRow: string;
    seat: string;
    faceValuePrice: number;
    currency: string;
  }>;
};

export type BrowseListingSellerDetails = {
  ticketSource: string;
  ticketingExperience: string;
  sellingReason: string;
  priceExplanation: string;
};

export async function fetchBrowseListingSellerDetails(
  listingId: string
): Promise<{ data: BrowseListingSellerDetails | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_browse_listing_seller_details", { p_listing_id: listingId });
  if (error) return { data: null, error: error.message };
  const r = data as any;
  if (!r) return { data: null, error: null };
  return {
    data: {
      ticketSource: String(r.ticketSource ?? r.ticket_source ?? ""),
      ticketingExperience: String(r.ticketingExperience ?? r.ticketing_experience ?? ""),
      sellingReason: String(r.sellingReason ?? r.selling_reason ?? ""),
      priceExplanation: String(r.priceExplanation ?? r.price_explanation ?? ""),
    },
    error: null,
  };
}

export async function fetchBrowseListings(): Promise<{ data: BrowseListingCard[]; error: string | null }> {
  const { data, error } = await supabase.rpc("browse_listings");
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => {
      const rawSeats = Array.isArray(r.seats) ? r.seats : [];
      const seats: BrowseListingSeat[] = rawSeats.map((s: any) => ({
        section: String(s?.section ?? ""),
        seatRow: String(s?.seat_row ?? ""),
        seat: String(s?.seat ?? ""),
        faceValuePrice: Number(s?.face_value_price ?? 0),
        currency: String(s?.currency ?? "USD"),
      }));
      const seatCount = Math.max(1, Math.min(4, Number(r.seat_count ?? seats.length ?? 1) || 1));
      const quantity = seats.length > 0 ? seats.length : seatCount;
      return {
        listingId: String(r.listing_id),
        concertCity: String(r.concert_city ?? ""),
        concertDate: String(r.concert_date ?? ""),
        status: String(r.status ?? "active"),
        lockExpiresAt: r.lock_expires_at != null ? String(r.lock_expires_at) : null,
        vip: Boolean(r.vip ?? false),
        loge: Boolean(r.loge ?? false),
        suite: Boolean(r.suite ?? false),
        quantity,
        seats,
      };
    }),
    error: null,
  };
}

export async function fetchMyListings(userId: string): Promise<{ data: MyListing[]; error: string | null }> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, concert_city, concert_date, ticket_source, ticketing_experience, selling_reason, price_explanation, status, processing_until, locked_by, lock_expires_at, created_at, vip, loge, listing_seats(seat_index, section, seat_row, seat, face_value_price, currency)"
    )
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      concertCity: String(r.concert_city ?? ""),
      concertDate: String(r.concert_date ?? ""),
      ticketSource: String(r.ticket_source ?? ""),
      ticketingExperience: String(r.ticketing_experience ?? ""),
      sellingReason: String(r.selling_reason ?? ""),
      priceExplanation: r.price_explanation != null ? String(r.price_explanation) : null,
      vip: Boolean(r.vip ?? false),
      loge: Boolean(r.loge ?? false),
      suite: Boolean(r.suite ?? false),
      status: String(r.status ?? "processing") as MyListing["status"],
      processingUntil: String(r.processing_until ?? ""),
      lockedBy: r.locked_by != null ? String(r.locked_by) : null,
      lockExpiresAt: r.lock_expires_at != null ? String(r.lock_expires_at) : null,
      createdAt: String(r.created_at ?? ""),
      seats: ((r.listing_seats ?? []) as any[])
        .map((s) => ({
          seatIndex: Number(s.seat_index ?? 1),
          section: String(s.section ?? ""),
          seatRow: String(s.seat_row ?? ""),
          seat: String(s.seat ?? ""),
          faceValuePrice: Number(s.face_value_price ?? 0),
          currency: String(s.currency ?? "USD"),
        }))
        .sort((a, b) => a.seatIndex - b.seatIndex),
    })),
    error: null,
  };
}

export async function connectToListing(listingId: string): Promise<{ connectionId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("connect_to_listing", { p_listing_id: listingId });
  if (error) return { connectionId: null, error: error.message };
  return { connectionId: String(data ?? ""), error: null };
}

/** v2: connect with socials intent and optional bonding answers (required if user has none). */
export async function connectToListingV2(
  listingId: string,
  wantSocialShare: boolean,
  bondingAnswers?: Record<string, string> | null
): Promise<{ connectionId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("connect_to_listing_v2", {
    p_listing_id: listingId,
    p_want_social_share: wantSocialShare,
    p_bonding_answers: bondingAnswers ?? null,
  });
  if (error) return { connectionId: null, error: error.message };
  return { connectionId: String(data ?? ""), error: null };
}

/** Get the 2 connection bonding question IDs (for v2 flow). */
export async function getConnectionBondingQuestionIds(): Promise<{ data: string[] | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_connection_bonding_question_ids");
  if (error) return { data: null, error: error.message };
  const arr = Array.isArray(data) ? data : [];
  return { data: arr.map((id: unknown) => String(id)), error: null };
}

/** Save or update user-level bonding answers (2 questions). */
export async function upsertUserBondingAnswers(
  questionIds: string[],
  answers: Record<string, string>
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("upsert_user_bonding_answers", {
    p_question_ids: questionIds,
    p_answers: answers,
  });
  return { error: error?.message ?? null };
}

/** Check if current user has user-level bonding answers. */
export async function hasUserBondingAnswers(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_bonding_answers")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function sellerRespondConnection(
  connectionId: string,
  accept: boolean,
  sellerSocialShare?: boolean | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("seller_respond_connection", {
    p_connection_id: connectionId,
    p_accept: accept,
    p_seller_social_share: accept ? sellerSocialShare ?? null : null,
  });
  return { error: error?.message ?? null };
}

export async function submitBondingAnswers(connectionId: string, answers: Record<string, string>): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("submit_bonding_answers", { p_connection_id: connectionId, p_answers: answers });
  return { error: error?.message ?? null };
}

export async function setComfortDecision(connectionId: string, comfort: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_comfort_decision", { p_connection_id: connectionId, p_comfort: comfort });
  return { error: error?.message ?? null };
}

export async function setSocialShareDecision(connectionId: string, share: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_social_share_decision", { p_connection_id: connectionId, p_share: share });
  return { error: error?.message ?? null };
}

export async function acceptConnectionAgreement(connectionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("accept_connection_agreement", { p_connection_id: connectionId });
  return { error: error?.message ?? null };
}

export async function endConnection(connectionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("end_connection", { p_connection_id: connectionId });
  return { error: error?.message ?? null };
}

