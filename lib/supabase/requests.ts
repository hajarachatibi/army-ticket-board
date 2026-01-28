import { supabase } from "@/lib/supabaseClient";
import type { Request, RequestStatus } from "@/lib/RequestContext";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type DbRequest = {
  id: string;
  ticket_id: string;
  requester_id: string;
  requester_username: string;
  status: string;
  accepted_by: string | null;
  event: string | null;
  seat_preference: string | null;
  created_at: string;
  updated_at: string;
};

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function mapRow(d: DbRequest): Request {
  return {
    id: d.id,
    ticketId: d.ticket_id,
    requesterId: d.requester_id,
    requesterUsername: d.requester_username,
    status: d.status as RequestStatus,
    acceptedBy: d.accepted_by,
    createdAt: toMs(d.created_at),
    event: d.event ?? "—",
    seatPreference: d.seat_preference ?? "—",
  };
}

export async function fetchRequestsForTicket(
  ticketId: string
): Promise<{ data: Request[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []).map((r) => mapRow(r as DbRequest)), error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch requests",
    };
  }
}

/** Insert request via REST API with explicit JWT. Avoids client not sending token (RLS). */
async function insertRequestWithToken(
  params: {
    ticketId: string;
    requesterId: string;
    requesterUsername: string;
    event?: string | null;
    seatPreference?: string | null;
    status?: "pending" | "accepted" | "rejected" | "closed";
    acceptedBy?: string | null;
  },
  accessToken: string
): Promise<{ data: Request | null; error: string | null }> {
  const body: Record<string, unknown> = {
    ticket_id: params.ticketId,
    requester_id: params.requesterId,
    requester_username: params.requesterUsername,
    event: params.event ?? "—",
    seat_preference: params.seatPreference ?? "—",
  };
  if (params.status) body.status = params.status;
  if (params.acceptedBy != null) body.accepted_by = params.acceptedBy;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
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

  const arr = (await res.json()) as DbRequest[];
  const raw = Array.isArray(arr) && arr.length ? arr[0] : null;
  if (!raw) return { data: null, error: "No row returned" };
  return { data: mapRow(raw), error: null };
}

export async function insertRequest(params: {
  ticketId: string;
  requesterId: string;
  requesterUsername: string;
  event?: string | null;
  seatPreference?: string | null;
  status?: "pending" | "accepted" | "rejected" | "closed";
  acceptedBy?: string | null;
}): Promise<{ data: Request | null; error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      return insertRequestWithToken(params, token);
    }

    const row: Record<string, unknown> = {
      ticket_id: params.ticketId,
      requester_id: params.requesterId,
      requester_username: params.requesterUsername,
      event: params.event ?? "—",
      seat_preference: params.seatPreference ?? "—",
    };
    if (params.status) row.status = params.status;
    if (params.acceptedBy != null) row.accepted_by = params.acceptedBy;
    const { data, error } = await supabase
      .from("requests")
      .insert(row)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapRow(data as DbRequest), error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to create request",
    };
  }
}

export async function updateRequestStatus(
  requestId: string,
  status: "accepted" | "rejected" | "closed",
  acceptedBy?: string
): Promise<{ error: string | null }> {
  try {
    const row: Record<string, unknown> = { status };
    if (status === "accepted" && acceptedBy != null) row.accepted_by = acceptedBy;
    const { error } = await supabase
      .from("requests")
      .update(row)
      .eq("id", requestId);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update request" };
  }
}
