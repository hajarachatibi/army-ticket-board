import { supabase } from "@/lib/supabaseClient";

export type ArmyStory = {
  id: string;
  authorId: string;
  authorUsername: string;
  anonymous: boolean;
  title: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export async function fetchApprovedStories(): Promise<{ data: ArmyStory[]; error: string | null }> {
  const { data, error } = await supabase
    .from("army_stories")
    .select("id, author_id, author_username, anonymous, title, body, status, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      authorId: String(r.author_id),
      authorUsername: String(r.author_username ?? "ARMY"),
      anonymous: Boolean(r.anonymous),
      title: String(r.title ?? ""),
      body: String(r.body ?? ""),
      status: (String(r.status ?? "approved") as ArmyStory["status"]),
      createdAt: String(r.created_at),
    })),
    error: null,
  };
}

export async function submitStory(params: {
  authorId: string;
  authorUsername: string;
  anonymous: boolean;
  title: string;
  body: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("army_stories").insert({
    author_id: params.authorId,
    author_username: params.authorUsername,
    anonymous: params.anonymous,
    title: params.title,
    body: params.body,
    status: "pending",
  });
  return { error: error?.message ?? null };
}

export async function adminFetchPendingStories(): Promise<{ data: ArmyStory[]; error: string | null }> {
  const { data, error } = await supabase
    .from("army_stories")
    .select("id, author_id, author_username, anonymous, title, body, status, created_at")
    .neq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      authorId: String(r.author_id),
      authorUsername: String(r.author_username ?? "ARMY"),
      anonymous: Boolean(r.anonymous),
      title: String(r.title ?? ""),
      body: String(r.body ?? ""),
      status: (String(r.status ?? "pending") as ArmyStory["status"]),
      createdAt: String(r.created_at),
    })),
    error: null,
  };
}

export async function adminModerateStory(params: { id: string; status: "approved" | "rejected" }): Promise<{ error: string | null }> {
  const { error } = await supabase.from("army_stories").update({ status: params.status }).eq("id", params.id);
  return { error: error?.message ?? null };
}

export async function adminDeleteStory(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("army_stories").delete().eq("id", id);
  return { error: error?.message ?? null };
}

