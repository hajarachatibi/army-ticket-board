import { supabase } from "@/lib/supabaseClient";
import type { Ticket } from "@/lib/data/tickets";

export type AdminReport = {
  id: string;
  ticketId: string;
  ticketEvent: string;
  ticketCity: string;
  ticketDay: string;
  reporterUsername: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  username: string;
  email: string;
  createdAt: string | null;
  lastLoginAt: string | null;
};

function mapTicketRow(d: Record<string, unknown>): Ticket {
  return {
    id: String(d.id),
    event: String(d.event ?? ""),
    city: String(d.city ?? ""),
    day: String(d.day ?? ""),
    vip: Boolean(d.vip),
    quantity: Number(d.quantity) || 0,
    section: String(d.section ?? ""),
    row: String(d.seat_row ?? ""),
    seat: String(d.seat ?? ""),
    type: (d.type as "Seat" | "Standing") ?? "Seat",
    status: (d.status as "Available" | "Sold") ?? "Available",
    ownerId: d.owner_id != null ? String(d.owner_id) : null,
    price: Number(d.price) || 0,
    currency: String(d.currency ?? "USD"),
  };
}

export async function fetchAdminReports(): Promise<{
  data: AdminReport[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select(
        `
        id,
        ticket_id,
        reported_by_username,
        reason,
        details,
        created_at,
        tickets ( event, city, day )
      `
      )
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };

    type Row = {
      id: string;
      ticket_id: string;
      reported_by_username: string | null;
      reason: string;
      details: string | null;
      created_at: string;
      tickets: { event: string; city: string; day: string } | { event: string; city: string; day: string }[] | null;
    };
    const rows = (data ?? []) as Row[];
    const ticketInfo = (r: Row) => {
      const t = Array.isArray(r.tickets) ? r.tickets[0] : r.tickets;
      return t ?? null;
    };

    const out: AdminReport[] = rows.map((r) => {
      const t = ticketInfo(r);
      return {
        id: r.id,
        ticketId: r.ticket_id,
        ticketEvent: t?.event ?? "—",
        ticketCity: t?.city ?? "—",
        ticketDay: t?.day ?? "—",
        reporterUsername: r.reported_by_username,
        reason: r.reason,
        details: r.details,
        createdAt: r.created_at,
      };
    });
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
}): Promise<{ data: Ticket[]; total: number; error: string | null }> {
  try {
    const offset = params.page * TICKETS_PAGE_SIZE;
    const { data, error, count } = await supabase
      .from("tickets")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + TICKETS_PAGE_SIZE - 1);

    if (error) return { data: [], total: 0, error: error.message };
    const total = count ?? 0;
    const list = (data ?? []).map((d) => mapTicketRow(d as Record<string, unknown>));
    return { data: list, total, error: null };
  } catch (e) {
    return {
      data: [],
      total: 0,
      error: e instanceof Error ? e.message : "Failed to fetch tickets",
    };
  }
}

const USER_PAGE_SIZE = 24;

type AdminUserRow = {
  id: string;
  username: string;
  email: string;
  created_at: string | null;
  last_login_at: string | null;
};

function mapAdminUser(r: AdminUserRow): AdminUser {
  return {
    id: r.id,
    username: r.username ?? "",
    email: r.email ?? "",
    createdAt: r.created_at ?? null,
    lastLoginAt: r.last_login_at ?? null,
  };
}

async function fetchAdminUserListPaged(
  rpc: "admin_list_sellers_paged" | "admin_list_buyers_paged" | "admin_list_all_users_paged",
  page: number,
  pageSize: number
): Promise<{ data: AdminUser[]; total: number; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc(rpc, {
      p_limit: pageSize,
      p_offset: page * pageSize,
    });
    if (error) return { data: [], total: 0, error: error.message };
    const obj = data as { data: AdminUserRow[]; total?: number | string } | null;
    const list = Array.isArray(obj?.data) ? obj.data : [];
    const total = Math.max(0, Number(obj?.total ?? 0));
    return { data: list.map(mapAdminUser), total, error: null };
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
}): Promise<{ data: AdminUser[]; total: number; error: string | null }> {
  return fetchAdminUserListPaged(
    "admin_list_sellers_paged",
    params.page,
    params.pageSize ?? USER_PAGE_SIZE
  );
}

export async function fetchAdminBuyersPage(params: {
  page: number;
  pageSize?: number;
}): Promise<{ data: AdminUser[]; total: number; error: string | null }> {
  return fetchAdminUserListPaged(
    "admin_list_buyers_paged",
    params.page,
    params.pageSize ?? USER_PAGE_SIZE
  );
}

export async function fetchAdminAllUsersPage(params: {
  page: number;
  pageSize?: number;
}): Promise<{ data: AdminUser[]; total: number; error: string | null }> {
  return fetchAdminUserListPaged(
    "admin_list_all_users_paged",
    params.page,
    params.pageSize ?? USER_PAGE_SIZE
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
      fetchAdminUserListPaged("admin_list_sellers_paged", 0, 1),
      fetchAdminUserListPaged("admin_list_buyers_paged", 0, 1),
      fetchAdminUserListPaged("admin_list_all_users_paged", 0, 1),
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

export async function adminSendMessage(
  recipientIds: string[],
  message: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("admin_send_message", {
      p_recipient_ids: recipientIds,
      p_message: message,
    });
    return { error: error?.message ?? null };
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
