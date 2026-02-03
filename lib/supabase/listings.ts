import { supabase } from "@/lib/supabaseClient";

export type BrowseListingCard = {
  listingId: string;
  concertCity: string;
  concertDate: string;
  section: string;
  seatRow: string;
  seat: string;
  faceValuePrice: number;
  currency: string;
  status: "processing" | "active" | "locked" | "sold" | "removed" | string;
  lockExpiresAt: string | null;
  vip: boolean;
  /** Number of seats (1–4) in this listing. */
  quantity: number;
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
    data: rows.map((r) => ({
      listingId: String(r.listing_id),
      concertCity: String(r.concert_city ?? ""),
      concertDate: String(r.concert_date ?? ""),
      section: String(r.section ?? ""),
      seatRow: String(r.seat_row ?? ""),
      seat: String(r.seat ?? ""),
      faceValuePrice: Number(r.face_value_price ?? 0),
      currency: String(r.currency ?? "USD"),
      status: String(r.status ?? "active"),
      lockExpiresAt: r.lock_expires_at != null ? String(r.lock_expires_at) : null,
      vip: Boolean(r.vip ?? false),
      quantity: Math.max(1, Math.min(4, Number(r.seat_count ?? 1) || 1)),
    })),
    error: null,
  };
}

export async function fetchMyListings(userId: string): Promise<{ data: MyListing[]; error: string | null }> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, concert_city, concert_date, ticket_source, ticketing_experience, selling_reason, price_explanation, status, processing_until, locked_by, lock_expires_at, created_at, listing_seats(seat_index, section, seat_row, seat, face_value_price, currency)"
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

export async function sellerRespondConnection(connectionId: string, accept: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("seller_respond_connection", { p_connection_id: connectionId, p_accept: accept });
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

