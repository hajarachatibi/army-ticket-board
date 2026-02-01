import { supabase } from "@/lib/supabaseClient";

export type UserProfile = {
  id: string;
  username: string;
  role: string;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  snapchat?: string | null;
};

export async function fetchProfile(
  userId: string
): Promise<{ data: UserProfile | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, username, role, instagram, facebook, tiktok, snapchat")
      .eq("id", userId)
      .single();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };

    return {
      data: {
        id: String(data.id),
        username: String(data.username ?? "ARMY"),
        role: String(data.role ?? "user"),
        instagram: data.instagram != null ? String(data.instagram) : null,
        facebook: data.facebook != null ? String(data.facebook) : null,
        tiktok: data.tiktok != null ? String(data.tiktok) : null,
        snapchat: data.snapchat != null ? String(data.snapchat) : null,
      },
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to fetch profile",
    };
  }
}
