import { supabase } from "@/lib/supabaseClient";
import type { Ticket, TicketStatus, TicketType } from "@/lib/data/tickets";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type DbTicket = {
  id: string;
  event: string;
  city: string;
  day: string;
  vip: boolean;
  quantity: number;
  section: string;
  seat_row: string;
  seat: string;
  type: string;
  status: string;
  owner_id: string | null;
  price: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

function mapRow(d: DbTicket): Ticket {
  return {
    id: d.id,
    event: d.event,
    city: d.city,
    day: d.day,
    vip: d.vip,
    quantity: d.quantity,
    section: d.section,
    row: d.seat_row,
    seat: d.seat,
    type: d.type as TicketType,
    status: d.status as TicketStatus,
    ownerId: d.owner_id,
    price: Number(d.price) || 0,
    currency: d.currency ?? "USD",
  };
}

export type FetchTicketsFilters = {
  ownerId?: string | null;
  event?: string | null;
  status?: string | null;
  city?: string | null;
  day?: string | null;
  vip?: boolean | null;
  section?: string | null;
  row?: string | null;
  type?: string | null;
  quantity?: number | null;
};

export const TICKETS_PAGE_SIZE = 24;

export async function fetchTicketsPage(params: {
  limit: number;
  offset: number;
  filters?: FetchTicketsFilters;
}): Promise<{ data: Ticket[]; total: number; error: string | null }> {
  try {
    const { limit, offset, filters } = params;
    let q = supabase
      .from("tickets")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters?.ownerId != null) q = q.eq("owner_id", filters.ownerId);
    if (filters?.event != null && filters.event !== "all") q = q.eq("event", filters.event);
    if (filters?.status != null && filters.status !== "all") q = q.eq("status", filters.status);
    if (filters?.city != null && filters.city !== "all") q = q.eq("city", filters.city);
    if (filters?.day != null && filters.day !== "all") q = q.eq("day", filters.day);
    if (filters?.vip != null) q = q.eq("vip", filters.vip);
    if (filters?.section != null && filters.section !== "all") q = q.eq("section", filters.section);
    if (filters?.row != null && filters.row !== "all") q = q.eq("seat_row", filters.row);
    if (filters?.type != null && filters.type !== "all") q = q.eq("type", filters.type);
    if (filters?.quantity != null) q = q.eq("quantity", filters.quantity);

    const { data, error, count } = await q.range(offset, offset + limit - 1);
    if (error) return { data: [], total: 0, error: error.message };
    const total = count ?? 0;
    return { data: (data ?? []).map((d) => mapRow(d as DbTicket)), total, error: null };
  } catch (e) {
    return {
      data: [],
      total: 0,
      error: e instanceof Error ? e.message : "Failed to fetch tickets",
    };
  }
}

export type TicketFilterOptions = {
  events: string[];
  cities: string[];
  days: string[];
  sections: string[];
  rows: string[];
  quantities: number[];
};

/** Fetch distinct filter values for dropdowns (all tickets, or scoped to owner). One cheap RPC. */
export async function fetchTicketFilterOptions(
  ownerId?: string | null
): Promise<{ data: TicketFilterOptions | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("get_ticket_filter_options", {
      p_owner_id: ownerId ?? null,
    });
    if (error) return { data: null, error: error.message };
    const raw = data as {
      events?: unknown;
      cities?: unknown;
      days?: unknown;
      sections?: unknown;
      rows?: unknown;
      quantities?: unknown;
    };
    const arr = (x: unknown) => (Array.isArray(x) ? x : []) as string[] | number[];
    return {
      data: {
        events: arr(raw?.events).map(String).sort(),
        cities: arr(raw?.cities).map(String).sort(),
        days: arr(raw?.days).map(String).sort(),
        sections: arr(raw?.sections).map(String).sort(),
        rows: arr(raw?.rows).map(String).sort(),
        quantities: arr(raw?.quantities)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
          .sort((a, b) => a - b),
      },
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to fetch filter options",
    };
  }
}

/** Fetch all tickets (optionally for one owner). Used when activity filter is contacted/reported. */
export async function fetchTickets(ownerId?: string | null): Promise<{ data: Ticket[]; error: string | null }> {
  try {
    let q = supabase.from("tickets").select("*").order("created_at", { ascending: false });
    if (ownerId != null) q = q.eq("owner_id", ownerId);
    const { data, error } = await q;
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []).map((d) => mapRow(d as DbTicket)), error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch tickets",
    };
  }
}

export type InsertTicket = Omit<Ticket, "id" | "status"> & { status?: TicketStatus };

/** Insert ticket via REST API with explicit JWT. Avoids client not sending token (401/RLS). */
async function insertTicketWithToken(
  t: InsertTicket,
  accessToken: string
): Promise<{ data: Ticket | null; error: string | null }> {
  const body = {
    event: t.event,
    city: t.city,
    day: t.day,
    vip: t.vip,
    quantity: t.quantity,
    section: t.section,
    seat_row: t.row,
    seat: t.seat,
    type: t.type,
    status: t.status ?? "Available",
    owner_id: t.ownerId,
    price: t.price ?? 0,
    currency: t.currency ?? "USD",
  };

  const token = String(accessToken).trim();
  if (!token) return { data: null, error: "Missing access token" };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/tickets?select=*`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (typeof j?.message === "string") msg = j.message;
    } catch {
      /* ignore */
    }
    return { data: null, error: msg };
  }

  const arr = (await res.json()) as DbTicket[];
  const raw = Array.isArray(arr) && arr.length ? arr[0] : null;
  if (!raw) return { data: null, error: "No row returned" };
  return { data: mapRow(raw), error: null };
}

export async function insertTicket(
  t: InsertTicket,
  /** Pass when caller has token (e.g. from useAuth().getAccessToken) to avoid client not sending JWT. */
  accessToken?: string | null
): Promise<{ data: Ticket | null; error: string | null }> {
  try {
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token ?? null;
    if (token) {
      return insertTicketWithToken(t, token);
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        event: t.event,
        city: t.city,
        day: t.day,
        vip: t.vip,
        quantity: t.quantity,
        section: t.section,
        seat_row: t.row,
        seat: t.seat,
        type: t.type,
        status: t.status ?? "Available",
        owner_id: t.ownerId,
        price: t.price ?? 0,
        currency: t.currency ?? "USD",
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRow(data as DbTicket), error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to create ticket",
    };
  }
}

export async function updateTicket(
  id: string,
  updates: Partial<Pick<Ticket, "status" | "event" | "city" | "day" | "vip" | "quantity" | "section" | "row" | "seat" | "type" | "price" | "currency">>
): Promise<{ data: Ticket | null; error: string | null }> {
  try {
    const row: Record<string, unknown> = {};
    if (updates.status != null) row.status = updates.status;
    if (updates.event != null) row.event = updates.event;
    if (updates.city != null) row.city = updates.city;
    if (updates.day != null) row.day = updates.day;
    if (updates.vip != null) row.vip = updates.vip;
    if (updates.quantity != null) row.quantity = updates.quantity;
    if (updates.section != null) row.section = updates.section;
    if (updates.row != null) row.seat_row = updates.row;
    if (updates.seat != null) row.seat = updates.seat;
    if (updates.type != null) row.type = updates.type;
    if (updates.price != null) row.price = updates.price;
    if (updates.currency != null) row.currency = updates.currency;

    const { data, error } = await supabase
      .from("tickets")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRow(data as DbTicket), error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to update ticket",
    };
  }
}

export async function deleteTicket(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete ticket" };
  }
}
