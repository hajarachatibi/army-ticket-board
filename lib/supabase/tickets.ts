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

export async function fetchTickets(): Promise<{ data: Ticket[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []).map(mapRow), error: null };
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
