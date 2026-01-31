import { supabase } from "@/lib/supabaseClient";

export type UserProfile = {
  id: string;
  username: string;
  role: string;
};

export async function fetchProfile(
  userId: string
): Promise<{ data: UserProfile | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, username, role")
      .eq("id", userId)
      .single();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };

    return {
      data: {
        id: String(data.id),
        username: String(data.username ?? "ARMY"),
        role: String(data.role ?? "user"),
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
