import { supabase } from "@/lib/supabaseClient";

export type PublicStats = {
  tickets: number;
  events: number;
  sold: number;
};

export async function fetchPublicStats(): Promise<{ data: PublicStats | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("public_stats");
    if (error) return { data: null, error: error.message };
    const o = data as Record<string, number> | null;
    if (!o) return { data: null, error: "No stats" };
    return {
      data: {
        tickets: Number(o.tickets) || 0,
        events: Number(o.events) || 0,
        sold: Number(o.sold) || 0,
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
