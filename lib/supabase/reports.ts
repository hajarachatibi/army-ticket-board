import { supabase } from "@/lib/supabaseClient";

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
