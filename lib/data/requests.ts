import { supabase } from "@/lib/supabaseClient";

export type Request = {
  id: string;
  ticket_id: string;
  user_id?: string;
  username?: string;
  event?: string;
  seat_preference?: string;
  created_at?: string;
};

export async function fetchRequestsByTicket(
  ticketId: string
): Promise<{ data: Request[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("requests")
      .select("id, ticket_id, user_id, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };

    const mapped: Request[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      ticket_id: String(r.ticket_id),
      user_id: r.user_id != null ? String(r.user_id) : undefined,
      username: r.username != null ? String(r.username) : undefined,
      seat_preference: r.seat_preference != null ? String(r.seat_preference) : undefined,
      created_at: r.created_at != null ? String(r.created_at) : undefined,
    }));

    return { data: mapped, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Failed to fetch requests" };
  }
}

export const PLACEHOLDER_REQUESTS: Request[] = [
  { id: "R-1", ticket_id: "T-001", username: "ARMY_Seoul", event: "Arirang World Tour — Seoul", seat_preference: "Section A", created_at: "2025-01-10T12:00:00Z" },
  { id: "R-2", ticket_id: "T-001", username: "ARMY_LA", event: "Arirang World Tour — Seoul", seat_preference: "Front rows", created_at: "2025-01-09T14:30:00Z" },
];
