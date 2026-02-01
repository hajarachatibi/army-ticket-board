import { supabase } from "@/lib/supabaseClient";

export type AdminReport = {
  id: string;
  ticketId: string;
  reporterId: string | null;
  reporterEmail: string | null;
  ownerId: string | null;
  ticketEvent: string;
  ticketCity: string;
  ticketDay: string;
  ticketSection: string;
  ticketRow: string;
  ticketSeat: string;
  ticketType: string;
  ticketQuantity: number;
  ticketPrice: number;
  ticketCurrency: string;
  ticketStatus: string;
  ownerEmail: string | null;
  reporterUsername: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
};

export type AdminListingReport = {
  id: string;
  listingId: string;
  reporterId: string | null;
  reporterEmail: string | null;
  sellerId: string | null;
  sellerEmail: string | null;
  reporterUsername: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
  concertCity: string;
  concertDate: string;
  listingStatus: string;
  section: string;
  seatRow: string;
  seat: string;
  faceValuePrice: number;
  currency: string;
};

export type AdminListing = {
  id: string;
  sellerEmail: string | null;
  concertCity: string;
  concertDate: string;
  status: string;
  createdAt: string;
  section: string;
  seatRow: string;
  seat: string;
  faceValuePrice: number;
  currency: string;
};

export type AdminUserReport = {
  id: string;
  reportedUserId: string | null;
  reportedEmail: string | null;
  reporterId: string | null;
  reporterEmail: string | null;
  reporterUsername: string | null;
  reason: string;
  details: string | null;
  imagePath: string | null;
  createdAt: string;
};

export type AdminTicket = {
  id: string;
  event: string;
  city: string;
  day: string;
  vip?: boolean;
  quantity?: number;
  section: string;
  row: string;
  seat: string;
  type: string;
  status: string;
  price: number;
  currency: string;
  ownerId: string | null;
  ownerEmail: string | null;
  listingStatus?: "pending_review" | "approved" | "rejected";
  claimedBy: string | null;
  claimedByEmail: string | null;
  claimedAt: string | null;
  proofTmTicketPagePath?: string | null;
  proofTmScreenRecordingPath?: string | null;
  proofTmEmailScreenshotPath?: string | null;
  proofPriceNote?: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  createdAt: string | null;
  lastLoginAt: string | null;
};

export type BannedUser = {
  email: string;
  bannedAt: string;
  reason: string | null;
};

export async function fetchAdminReports(): Promise<{
  data: AdminReport[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_reports_with_details");
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as Array<{
      id: string;
      ticket_id: string;
      reporter_id: string | null;
      reporter_email: string | null;
      owner_id: string | null;
      reported_by_username: string | null;
      reason: string;
      details: string | null;
      created_at: string;
      ticket_event: string;
      ticket_city: string;
      ticket_day: string;
      ticket_section: string;
      ticket_row: string;
      ticket_seat: string;
      ticket_type: string;
      ticket_quantity: number;
      ticket_price: number;
      ticket_currency: string;
      ticket_status: string;
      owner_email: string | null;
    }>;
    const out: AdminReport[] = rows.map((r) => ({
      id: r.id,
      ticketId: r.ticket_id,
      reporterId: r.reporter_id ?? null,
      reporterEmail: r.reporter_email ?? null,
      ownerId: r.owner_id ?? null,
      ticketEvent: r.ticket_event ?? "—",
      ticketCity: r.ticket_city ?? "—",
      ticketDay: r.ticket_day ?? "—",
      ticketSection: r.ticket_section ?? "—",
      ticketRow: r.ticket_row ?? "—",
      ticketSeat: r.ticket_seat ?? "—",
      ticketType: r.ticket_type ?? "—",
      ticketQuantity: Number(r.ticket_quantity) || 0,
      ticketPrice: Number(r.ticket_price) || 0,
      ticketCurrency: r.ticket_currency ?? "—",
      ticketStatus: r.ticket_status ?? "—",
      ownerEmail: r.owner_email ?? null,
      reporterUsername: r.reported_by_username,
      reason: r.reason,
      details: r.details,
      createdAt: r.created_at,
    }));
    return { data: out, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch reports",
    };
  }
}

export async function fetchAdminListingReports(): Promise<{
  data: AdminListingReport[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_listing_reports_with_details");
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      data: rows.map((r) => ({
        id: String(r.id),
        listingId: String(r.listing_id),
        reporterId: r.reporter_id != null ? String(r.reporter_id) : null,
        reporterEmail: r.reporter_email != null ? String(r.reporter_email) : null,
        sellerId: r.seller_id != null ? String(r.seller_id) : null,
        sellerEmail: r.seller_email != null ? String(r.seller_email) : null,
        reporterUsername: r.reported_by_username != null ? String(r.reported_by_username) : null,
        reason: String(r.reason ?? ""),
        details: r.details != null ? String(r.details) : null,
        createdAt: String(r.created_at ?? ""),
        concertCity: String(r.concert_city ?? ""),
        concertDate: String(r.concert_date ?? ""),
        listingStatus: String(r.listing_status ?? ""),
        section: String(r.section ?? ""),
        seatRow: String(r.seat_row ?? ""),
        seat: String(r.seat ?? ""),
        faceValuePrice: Number(r.face_value_price ?? 0),
        currency: String(r.currency ?? "USD"),
      })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Failed to fetch listing reports" };
  }
}

export async function adminDeleteListingReport(reportId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_delete_listing_report", { p_report_id: reportId });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete listing report" };
  }
}

export async function adminRemoveListing(listingId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_remove_listing", { p_listing_id: listingId });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove listing" };
  }
}

export async function fetchAdminListingsFiltered(params: {
  page: number;
  search?: string;
  status?: string; // '', 'active', 'sold', 'removed', 'processing', 'locked'
  pageSize?: number;
}): Promise<{ data: AdminListing[]; total: number; error: string | null }> {
  const pageSize = params.pageSize ?? 24;
  try {
    const { data, error } = await supabase.rpc("admin_listings_paged_filtered", {
      p_limit: pageSize,
      p_offset: params.page * pageSize,
      p_search: params.search ?? "",
      p_status: params.status ?? "",
    });
    if (error) return { data: [], total: 0, error: error.message };
    const obj = data as { data: Array<Record<string, unknown>>; total?: number | string } | null;
    const list = Array.isArray(obj?.data) ? obj.data : [];
    const total = Math.max(0, Number(obj?.total ?? 0));
    return {
      data: list.map((d) => ({
        id: String(d.id),
        sellerEmail: d.seller_email != null ? String(d.seller_email) : null,
        concertCity: String(d.concert_city ?? ""),
        concertDate: String(d.concert_date ?? ""),
        status: String(d.status ?? ""),
        createdAt: String(d.created_at ?? ""),
        section: String(d.section ?? ""),
        seatRow: String(d.seat_row ?? ""),
        seat: String(d.seat ?? ""),
        faceValuePrice: Number(d.face_value_price ?? 0),
        currency: String(d.currency ?? "USD"),
      })),
      total,
      error: null,
    };
  } catch (e) {
    return { data: [], total: 0, error: e instanceof Error ? e.message : "Failed to fetch listings" };
  }
}

export async function fetchAdminUserReports(): Promise<{
  data: AdminUserReport[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_user_reports_with_details");
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as Array<{
      id: string;
      reported_user_id: string | null;
      reported_email: string | null;
      reporter_id: string | null;
      reporter_email: string | null;
      reported_by_username: string | null;
      reason: string;
      details: string | null;
      image_url: string | null;
      created_at: string;
    }>;
    return {
      data: rows.map((r) => ({
        id: r.id,
        reportedUserId: r.reported_user_id ?? null,
        reportedEmail: r.reported_email ?? null,
        reporterId: r.reporter_id ?? null,
        reporterEmail: r.reporter_email ?? null,
        reporterUsername: r.reported_by_username ?? null,
        reason: r.reason,
        details: r.details ?? null,
        imagePath: r.image_url ? String(r.image_url) : null,
        createdAt: r.created_at,
      })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Failed to fetch user reports" };
  }
}

const TICKETS_PAGE_SIZE = 24;

export async function fetchAdminTickets(params: {
  page: number;
  search?: string;
}): Promise<{ data: AdminTicket[]; total: number; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("admin_tickets_paged", {
      p_limit: TICKETS_PAGE_SIZE,
      p_offset: params.page * TICKETS_PAGE_SIZE,
      p_search: params.search ?? "",
    });
    if (error) return { data: [], total: 0, error: error.message };
    const obj = data as { data: Array<Record<string, unknown>>; total?: number | string } | null;
    const list = Array.isArray(obj?.data) ? obj.data : [];
    const total = Math.max(0, Number(obj?.total ?? 0));
    const out: AdminTicket[] = list.map((d) => ({
      id: String(d.id),
      event: String(d.event ?? ""),
      city: String(d.city ?? ""),
      day: String(d.day ?? ""),
      vip: d.vip === true,
      quantity: typeof d.quantity === "number" ? d.quantity : undefined,
      section: String(d.section ?? ""),
      row: String(d.seat_row ?? ""),
      seat: String(d.seat ?? ""),
      type: String(d.type ?? ""),
      status: String(d.status ?? ""),
      price: Number(d.price) || 0,
      currency: String(d.currency ?? "USD"),
      ownerId: d.owner_id != null ? String(d.owner_id) : null,
      ownerEmail: d.owner_email != null ? String(d.owner_email) : null,
      listingStatus:
        d.listing_status === "pending_review" || d.listing_status === "approved" || d.listing_status === "rejected"
          ? d.listing_status
          : undefined,
      claimedBy: d.claimed_by != null ? String(d.claimed_by) : null,
      claimedByEmail: d.claimed_by_email != null ? String(d.claimed_by_email) : null,
      claimedAt: d.claimed_at != null ? String(d.claimed_at) : null,
      proofTmTicketPagePath: d.proof_tm_ticket_page_path != null ? String(d.proof_tm_ticket_page_path) : null,
      proofTmScreenRecordingPath: d.proof_tm_screen_recording_path != null ? String(d.proof_tm_screen_recording_path) : null,
      proofTmEmailScreenshotPath: d.proof_tm_email_screenshot_path != null ? String(d.proof_tm_email_screenshot_path) : null,
      proofPriceNote: d.proof_price_note != null ? String(d.proof_price_note) : null,
    }));
    return { data: out, total, error: null };
  } catch (e) {
    return {
      data: [],
      total: 0,
      error: e instanceof Error ? e.message : "Failed to fetch tickets",
    };
  }
}

export type AdminTicketsClaimedState = "claimed" | "unclaimed";

export async function fetchAdminTicketsFiltered(params: {
  page: number;
  search?: string;
  ticketStatus?: string | null; // e.g. 'Available' | 'Sold'
  listingStatus?: "pending_review" | "approved" | "rejected" | null;
  claimedState?: AdminTicketsClaimedState | null;
}): Promise<{ data: AdminTicket[]; total: number; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("admin_tickets_paged_filtered", {
      p_limit: TICKETS_PAGE_SIZE,
      p_offset: params.page * TICKETS_PAGE_SIZE,
      p_search: params.search ?? "",
      p_ticket_status: params.ticketStatus ?? null,
      p_listing_status: params.listingStatus ?? null,
      p_claimed_state: params.claimedState ?? null,
    });
    if (error) return { data: [], total: 0, error: error.message };
    const obj = data as { data: Array<Record<string, unknown>>; total?: number | string } | null;
    const list = Array.isArray(obj?.data) ? obj.data : [];
    const total = Math.max(0, Number(obj?.total ?? 0));
    const out: AdminTicket[] = list.map((d) => ({
      id: String(d.id),
      event: String(d.event ?? ""),
      city: String(d.city ?? ""),
      day: String(d.day ?? ""),
      vip: d.vip === true,
      quantity: typeof d.quantity === "number" ? d.quantity : undefined,
      section: String(d.section ?? ""),
      row: String(d.seat_row ?? ""),
      seat: String(d.seat ?? ""),
      type: String(d.type ?? ""),
      status: String(d.status ?? ""),
      price: Number(d.price) || 0,
      currency: String(d.currency ?? "USD"),
      ownerId: d.owner_id != null ? String(d.owner_id) : null,
      ownerEmail: d.owner_email != null ? String(d.owner_email) : null,
      listingStatus:
        d.listing_status === "pending_review" || d.listing_status === "approved" || d.listing_status === "rejected"
          ? d.listing_status
          : undefined,
      claimedBy: d.claimed_by != null ? String(d.claimed_by) : null,
      claimedByEmail: d.claimed_by_email != null ? String(d.claimed_by_email) : null,
      claimedAt: d.claimed_at != null ? String(d.claimed_at) : null,
      proofTmTicketPagePath: d.proof_tm_ticket_page_path != null ? String(d.proof_tm_ticket_page_path) : null,
      proofTmScreenRecordingPath: d.proof_tm_screen_recording_path != null ? String(d.proof_tm_screen_recording_path) : null,
      proofTmEmailScreenshotPath: d.proof_tm_email_screenshot_path != null ? String(d.proof_tm_email_screenshot_path) : null,
      proofPriceNote: d.proof_price_note != null ? String(d.proof_price_note) : null,
    }));
    return { data: out, total, error: null };
  } catch (e) {
    return {
      data: [],
      total: 0,
      error: e instanceof Error ? e.message : "Failed to fetch tickets",
    };
  }
}

export type AdminPendingTicket = AdminTicket;

export async function fetchAdminPendingTickets(): Promise<{
  data: AdminPendingTicket[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_pending_tickets");
    if (error) return { data: [], error: error.message };
    const list = Array.isArray(data) ? data : [];
    const out: AdminPendingTicket[] = list.map((d: Record<string, unknown>) => ({
      id: String(d.id),
      event: String(d.event ?? ""),
      city: String(d.city ?? ""),
      day: String(d.day ?? ""),
      vip: d.vip === true,
      quantity: typeof d.quantity === "number" ? d.quantity : undefined,
      section: String(d.section ?? ""),
      row: String(d.seat_row ?? ""),
      seat: String(d.seat ?? ""),
      type: String(d.type ?? ""),
      status: String(d.status ?? ""),
      price: Number(d.price) || 0,
      currency: String(d.currency ?? "USD"),
      ownerId: d.owner_id != null ? String(d.owner_id) : null,
      ownerEmail: d.owner_email != null ? String(d.owner_email) : null,
      listingStatus: "pending_review",
      claimedBy: d.claimed_by != null ? String(d.claimed_by) : null,
      claimedByEmail: d.claimed_by_email != null ? String(d.claimed_by_email) : null,
      claimedAt: d.claimed_at != null ? String(d.claimed_at) : null,
      proofTmTicketPagePath: d.proof_tm_ticket_page_path != null ? String(d.proof_tm_ticket_page_path) : null,
      proofTmScreenRecordingPath: d.proof_tm_screen_recording_path != null ? String(d.proof_tm_screen_recording_path) : null,
      proofTmEmailScreenshotPath: d.proof_tm_email_screenshot_path != null ? String(d.proof_tm_email_screenshot_path) : null,
      proofPriceNote: d.proof_price_note != null ? String(d.proof_price_note) : null,
    }));
    return { data: out, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch pending tickets",
    };
  }
}

export async function adminClaimTicket(ticketId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_claim_ticket", { p_ticket_id: ticketId });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to claim ticket" };
  }
}

export async function adminApproveTicket(ticketId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_approve_ticket", { p_ticket_id: ticketId });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to approve ticket" };
  }
}

export async function adminRejectTicket(ticketId: string, reason: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_reject_ticket", { p_ticket_id: ticketId, p_reason: reason });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reject ticket" };
  }
}

const USER_PAGE_SIZE = 24;

async function fetchAdminUserListPaged(
  rpc: "admin_list_sellers_paged" | "admin_list_buyers_paged" | "admin_list_all_users_paged",
  page: number,
  pageSize: number,
  search: string
): Promise<{ data: AdminUser[]; total: number; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc(rpc, {
      p_limit: pageSize,
      p_offset: page * pageSize,
      p_search: search,
    });
    if (error) return { data: [], total: 0, error: error.message };
    const obj = data as {
      data: Array<{ id: string; email: string; created_at?: string | null; last_login_at?: string | null }>;
      total?: number | string;
    } | null;
    const list = Array.isArray(obj?.data) ? obj.data : [];
    const total = Math.max(0, Number(obj?.total ?? 0));
    return {
      data: list.map((r) => ({
        id: r.id,
        email: r.email ?? "",
        createdAt: r.created_at ?? null,
        lastLoginAt: r.last_login_at ?? null,
      })),
      total,
      error: null,
    };
  } catch (e) {
    return {
      data: [],
      total: 0,
      error: e instanceof Error ? e.message : "Failed to fetch list",
    };
  }
}

export async function fetchAdminSellersPage(params: {
  page: number;
  pageSize?: number;
  search?: string;
}): Promise<{ data: AdminUser[]; total: number; error: string | null }> {
  return fetchAdminUserListPaged(
    "admin_list_sellers_paged",
    params.page,
    params.pageSize ?? USER_PAGE_SIZE,
    params.search ?? ""
  );
}

export async function fetchAdminBuyersPage(params: {
  page: number;
  pageSize?: number;
  search?: string;
}): Promise<{ data: AdminUser[]; total: number; error: string | null }> {
  return fetchAdminUserListPaged(
    "admin_list_buyers_paged",
    params.page,
    params.pageSize ?? USER_PAGE_SIZE,
    params.search ?? ""
  );
}

export async function fetchAdminAllUsersPage(params: {
  page: number;
  pageSize?: number;
  search?: string;
}): Promise<{ data: AdminUser[]; total: number; error: string | null }> {
  return fetchAdminUserListPaged(
    "admin_list_all_users_paged",
    params.page,
    params.pageSize ?? USER_PAGE_SIZE,
    params.search ?? ""
  );
}

/** Fetch only totals for message-all dropdown (limit=1, offset=0). */
export async function fetchAdminMessageAllTotals(): Promise<{
  sellersTotal: number;
  buyersTotal: number;
  allTotal: number;
  error: string | null;
}> {
  try {
    const [s, b, a] = await Promise.all([
      fetchAdminUserListPaged("admin_list_sellers_paged", 0, 1, ""),
      fetchAdminUserListPaged("admin_list_buyers_paged", 0, 1, ""),
      fetchAdminUserListPaged("admin_list_all_users_paged", 0, 1, ""),
    ]);
    return {
      sellersTotal: s.total,
      buyersTotal: b.total,
      allTotal: a.total,
      error: s.error || b.error || a.error || null,
    };
  } catch (e) {
    return {
      sellersTotal: 0,
      buyersTotal: 0,
      allTotal: 0,
      error: e instanceof Error ? e.message : "Failed to fetch totals",
    };
  }
}

export async function fetchAdminBannedUsers(): Promise<{
  data: BannedUser[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_list_banned");
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as Array<{ email: string; banned_at: string; reason: string | null }>;
    return {
      data: rows.map((r) => ({
        email: r.email,
        bannedAt: r.banned_at,
        reason: r.reason ?? null,
      })),
      error: null,
    };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch banned users",
    };
  }
}

export async function adminSendMessageToAllSellers(message: string): Promise<{
  count: number;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_send_message_to_all_sellers", {
      p_message: message,
    });
    if (error) return { count: 0, error: error.message };
    return { count: typeof data === "number" ? data : 0, error: null };
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : "Failed to send" };
  }
}

export async function adminSendMessageToAllBuyers(message: string): Promise<{
  count: number;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_send_message_to_all_buyers", {
      p_message: message,
    });
    if (error) return { count: 0, error: error.message };
    return { count: typeof data === "number" ? data : 0, error: null };
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : "Failed to send" };
  }
}

export async function adminSendMessageToAllUsers(message: string): Promise<{
  count: number;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_send_message_to_all_users", {
      p_message: message,
    });
    if (error) return { count: 0, error: error.message };
    return { count: typeof data === "number" ? data : 0, error: null };
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : "Failed to send" };
  }
}

export async function adminBanAndDeleteUser(email: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_ban_and_delete_user", { p_email: email });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to ban and delete user" };
  }
}

export async function adminDeleteTicket(ticketId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_delete_ticket", { p_ticket_id: ticketId });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete ticket" };
  }
}

export async function adminDeleteReport(reportId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_delete_report", { p_report_id: reportId });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete report" };
  }
}

export async function adminUnbanUser(email: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_unban_user", { p_email: email });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to unban user" };
  }
}

export type AdminDashboardStats = {
  users: number;
  listings: number;
  reports: number;
  banned: number;
  sellers: number;
  buyers: number;
};

export async function fetchAdminDashboardStats(): Promise<{
  data: AdminDashboardStats | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_dashboard_stats");
    if (error) return { data: null, error: error.message };
    const o = data as Record<string, number> | null;
    if (!o) return { data: null, error: "No stats" };
    return {
      data: {
        users: Number(o.users) || 0,
        listings: Number((o as any).listings) || 0,
        reports: Number(o.reports) || 0,
        banned: Number(o.banned) || 0,
        sellers: Number(o.sellers) || 0,
        buyers: Number(o.buyers) || 0,
      },
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to fetch stats",
    };
  }
}

export async function adminSendMessage(
  recipientIds: string[],
  message: string
): Promise<{ error: string | null }> {
  const trimmed = message?.trim() ?? "";
  const ids = Array.isArray(recipientIds) ? recipientIds.filter((id) => typeof id === "string" && id.length > 0) : [];
  if (!trimmed) return { error: "Message cannot be empty." };
  if (ids.length === 0) return { error: "No recipients." };

  try {
    const { error } = await supabase.rpc("admin_send_message", {
      p_recipient_ids: ids,
      p_message: trimmed,
    });
    return { error: error?.message ?? (error ? JSON.stringify(error) : null) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send message" };
  }
}

export async function fetchAdminMessagesForUser(userId: string): Promise<{
  data: Array<{ id: string; message: string; createdAt: string }>;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("admin_messages")
      .select("id, message, created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as Array<{ id: string; message: string; created_at: string }>;
    return {
      data: rows.map((r) => ({ id: r.id, message: r.message, createdAt: r.created_at })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Failed to fetch messages" };
  }
}
