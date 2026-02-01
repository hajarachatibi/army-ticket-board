import { supabase } from "@/lib/supabaseClient";

export type AdminRecommendation = {
  id: string;
  authorId: string;
  title: string;
  body: string;
  createdAt: string;
};

export async function fetchAdminRecommendations(): Promise<{ data: AdminRecommendation[]; error: string | null }> {
  const { data, error } = await supabase
    .from("admin_recommendations")
    .select("id, author_id, title, body, created_at")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      authorId: String(r.author_id),
      title: String(r.title ?? ""),
      body: String(r.body ?? ""),
      createdAt: String(r.created_at),
    })),
    error: null,
  };
}

export async function submitRecommendation(params: {
  authorId: string;
  title: string;
  body: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("admin_recommendations").insert({
    author_id: params.authorId,
    title: params.title,
    body: params.body,
  });
  return { error: error?.message ?? null };
}

export async function deleteAdminRecommendation(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("admin_recommendations").delete().eq("id", id);
  return { error: error?.message ?? null };
}

