import { supabase } from "@/lib/supabaseClient";
import type { Request, RequestStatus } from "@/lib/RequestContext";

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

export async function insertRequest(params: {
  ticketId: string;
  event?: string | null;
  seatPreference?: string | null;
}): Promise<{ data: Request | null; error: string | null }> {
  try {
    const res = await fetch("/api/requests/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: params.ticketId,
        event: params.event ?? "—",
        seatPreference: params.seatPreference ?? "—",
      }),
    });
    const j = (await res.json().catch(() => null)) as { data?: DbRequest; error?: string } | null;
    if (!res.ok) return { data: null, error: j?.error ?? `HTTP ${res.status}` };
    if (!j?.data) return { data: null, error: "No row returned" };
    return { data: mapRow(j.data), error: null };
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
