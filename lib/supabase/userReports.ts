import { supabase } from "@/lib/supabaseClient";

export async function insertUserReport(params: {
  reportedUserId: string;
  reporterId: string | null;
  reportedByUsername: string | null;
  reason: string;
  details?: string | null;
}): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("user_reports").insert({
      reported_user_id: params.reportedUserId,
      reporter_id: params.reporterId,
      reported_by_username: params.reportedByUsername,
      reason: params.reason,
      details: params.details ?? null,
    });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save user report" };
  }
}

