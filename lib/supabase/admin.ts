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

export type AdminTicket = {
  id: string;
  event: string;
  city: string;
  day: string;
  section: string;
  row: string;
  seat: string;
  type: string;
  status: string;
  price: number;
  currency: string;
  ownerEmail: string | null;
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
      section: String(d.section ?? ""),
      row: String(d.seat_row ?? ""),
      seat: String(d.seat ?? ""),
      type: String(d.type ?? ""),
      status: String(d.status ?? ""),
      price: Number(d.price) || 0,
      currency: String(d.currency ?? "USD"),
      ownerEmail: d.owner_email != null ? String(d.owner_email) : null,
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
  tickets: number;
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
        tickets: Number(o.tickets) || 0,
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
