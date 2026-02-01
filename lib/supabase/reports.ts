import { supabase } from "@/lib/supabaseClient";

/** Fetch ticket IDs the current user has reported. Used for "Reported" filter in browse. */
export async function fetchReportedTicketIds(
  userId: string
): Promise<{ data: string[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("ticket_id")
      .eq("reporter_id", userId);

    if (error) return { data: [], error: error.message };
    const ids = (data ?? [])
      .map((r: { ticket_id: string }) => r.ticket_id)
      .filter((id): id is string => typeof id === "string");
    return { data: [...new Set(ids)], error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch reported tickets",
    };
  }
}

export async function insertReport(params: {
  ticketId: string;
  reporterId: string | null;
  reportedByUsername: string | null;
  reason: string;
  details?: string | null;
}): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("reports").insert({
      ticket_id: params.ticketId,
      reporter_id: params.reporterId,
      reported_by_username: params.reportedByUsername,
      reason: params.reason,
      details: params.details ?? null,
    });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save report" };
  }
}
