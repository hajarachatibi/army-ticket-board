import { supabase } from "@/lib/supabaseClient";

export type LiteForumAnswer = {
  id: string;
  prompt: string;
  kind: "static" | "dynamic";
  position: number;
  answer: string;
};

export type LiteProfile = {
  id: string;
  username: string;
  isAdmin: boolean;
  /** Only returned when target is admin. */
  email: string;
  sellerApprovedCount: number;
  /** Admin-only. Empty string for non-admin viewers. */
  instagram?: string;
  /** Admin-only. Empty string for non-admin viewers. */
  facebook?: string;
  /** Admin-only. Empty string for non-admin viewers. */
  tiktok?: string;
  /** Admin-only. Empty string for non-admin viewers. */
  snapchat?: string;
  /** Admin-only. Empty string for non-admin viewers. */
  armyBiasAnswer?: string;
  /** Admin-only. Empty string for non-admin viewers. */
  armyYearsArmy?: string;
  /** Admin-only. Empty string for non-admin viewers. */
  armyFavoriteAlbum?: string;
  forumAnswers: LiteForumAnswer[];
};

export async function fetchLiteProfile(userId: string): Promise<{ data: LiteProfile | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_lite_profile", { p_user_id: userId });
  if (error) return { data: null, error: error.message };
  const d = data as any;
  if (!d) return { data: null, error: "No profile returned" };

  return {
    data: {
      id: String(d.id),
      username: String(d.username ?? "User"),
      isAdmin: Boolean(d.is_admin),
      email: String(d.email ?? ""),
      sellerApprovedCount: Number(d.seller_approved_count ?? 0),
      instagram: d.instagram != null ? String(d.instagram) : "",
      facebook: d.facebook != null ? String(d.facebook) : "",
      tiktok: d.tiktok != null ? String(d.tiktok) : "",
      snapchat: d.snapchat != null ? String(d.snapchat) : "",
      armyBiasAnswer: d.army_bias_answer != null ? String(d.army_bias_answer) : "",
      armyYearsArmy: d.army_years_army != null ? String(d.army_years_army) : "",
      armyFavoriteAlbum: d.army_favorite_album != null ? String(d.army_favorite_album) : "",
      forumAnswers: Array.isArray(d.forum_answers)
        ? d.forum_answers.map((a: any) => ({
            id: String(a.id),
            prompt: String(a.prompt ?? ""),
            kind: (String(a.kind ?? "dynamic") as "static" | "dynamic"),
            position: Number(a.position ?? 0),
            answer: String(a.answer ?? ""),
          }))
        : [],
    },
    error: null,
  };
}

export async function fetchAdminContacts(): Promise<{
  data: Array<{ id: string; username: string; email: string }> | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("list_admin_contacts");
  if (error) return { data: null, error: error.message };
  const rows = (data ?? []) as Array<{ id: string; username: string; email: string }>;
  return {
    data: rows.map((r) => ({ id: String(r.id), username: String(r.username ?? "Admin"), email: String(r.email ?? "") })),
    error: null,
  };
}

