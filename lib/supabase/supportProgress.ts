import { supabase } from "@/lib/supabaseClient";

export type SupportProgress = {
  targetAmountCents: number;
  currentAmountCents: number;
};

/** Percentage 0–100 (capped at 100 when current >= target). */
export function supportProgressPercentage(progress: SupportProgress): number {
  if (progress.targetAmountCents <= 0) return 0;
  const pct = (progress.currentAmountCents / progress.targetAmountCents) * 100;
  return Math.min(100, Math.round(pct * 10) / 10);
}

export async function fetchSupportProgress(): Promise<{
  data: SupportProgress | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("get_support_progress");
    if (error) return { data: null, error: error.message };
    const o = data as { target_amount_cents?: number; current_amount_cents?: number } | null;
    if (!o) return { data: null, error: null }; // hidden or not set
    return {
      data: {
        targetAmountCents: Number(o.target_amount_cents) || 0,
        currentAmountCents: Number(o.current_amount_cents) || 0,
      },
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to fetch support progress",
    };
  }
}
