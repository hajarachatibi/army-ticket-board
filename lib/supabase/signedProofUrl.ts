import { supabase } from "@/lib/supabaseClient";

const BUCKET = "proof-attachments";

export async function createSignedProofUrl(path: string, seconds = 60 * 20): Promise<{ url: string } | { error: string }> {
  const clean = (path ?? "").trim();
  if (!clean) return { error: "Missing path" };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(clean, seconds);
  if (error) return { error: error.message };
  if (!data?.signedUrl) return { error: "Failed to create signed URL" };
  return { url: data.signedUrl };
}

