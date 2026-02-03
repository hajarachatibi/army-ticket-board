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
  /** Admin comment/answer shown under the story when published. Only admins can set. */
  adminReply?: string | null;
  adminRepliedAt?: string | null;
  /** Author's own reply (only story owner can set). */
  authorReply?: string | null;
  authorRepliedAt?: string | null;
  /** Server-computed display name (masked for non-admins; only set when fetching via get_approved_stories). */
  authorDisplayName?: string | null;
};

const mapStoryRow = (r: any): ArmyStory => ({
  id: String(r.id),
  authorId: String(r.author_id),
  authorUsername: String(r.author_username ?? "ARMY"),
  anonymous: Boolean(r.anonymous),
  title: String(r.title ?? ""),
  body: String(r.body ?? ""),
  status: (String(r.status ?? "approved") as ArmyStory["status"]),
  createdAt: String(r.created_at),
  adminReply: r.admin_reply != null ? String(r.admin_reply) : null,
  adminRepliedAt: r.admin_replied_at != null ? String(r.admin_replied_at) : null,
  authorReply: r.author_reply != null ? String(r.author_reply) : null,
  authorRepliedAt: r.author_replied_at != null ? String(r.author_replied_at) : null,
  authorDisplayName: r.display_author != null ? String(r.display_author) : undefined,
});

/** Fetches approved stories with display_author (emails protected; only admins and story owner see full identity). */
export async function fetchApprovedStories(): Promise<{ data: ArmyStory[]; error: string | null }> {
  const { data, error } = await supabase.rpc("get_approved_stories");
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      authorId: String(r.author_id),
      authorUsername: "",
      anonymous: Boolean(r.anonymous),
      title: String(r.title ?? ""),
      body: String(r.body ?? ""),
      status: "approved" as const,
      createdAt: String(r.created_at),
      adminReply: r.admin_reply != null ? String(r.admin_reply) : null,
      adminRepliedAt: r.admin_replied_at != null ? String(r.admin_replied_at) : null,
      authorReply: r.author_reply != null ? String(r.author_reply) : null,
      authorRepliedAt: r.author_replied_at != null ? String(r.author_replied_at) : null,
      authorDisplayName: r.display_author != null ? String(r.display_author) : "ARMY",
    })),
    error: null,
  };
}

/** Story owner can set or clear their reply on their own approved story. */
export async function setMyStoryReply(storyId: string, reply: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_my_story_reply", {
    p_story_id: storyId,
    p_reply: reply ?? "",
  });
  return { error: error?.message ?? null };
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
    .select("id, author_id, author_username, anonymous, title, body, status, created_at, admin_reply, admin_replied_at, author_reply, author_replied_at")
    .neq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return { data: rows.map(mapStoryRow), error: null };
}

export async function adminModerateStory(params: {
  id: string;
  status: "approved" | "rejected";
  adminReply?: string | null;
}): Promise<{ error: string | null }> {
  const payload: { status: string; admin_reply?: string | null; admin_replied_at?: string | null } = {
    status: params.status,
  };
  if (params.adminReply !== undefined) {
    payload.admin_reply = params.adminReply?.trim() || null;
    payload.admin_replied_at = params.adminReply?.trim() ? new Date().toISOString() : null;
  }
  const { error } = await supabase.from("army_stories").update(payload).eq("id", params.id);
  return { error: error?.message ?? null };
}

export async function adminSetStoryReply(storyId: string, adminReply: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("army_stories")
    .update({
      admin_reply: adminReply?.trim() || null,
      admin_replied_at: adminReply?.trim() ? new Date().toISOString() : null,
    })
    .eq("id", storyId);
  return { error: error?.message ?? null };
}

export async function adminFetchApprovedStories(): Promise<{ data: ArmyStory[]; error: string | null }> {
  const { data, error } = await supabase
    .from("army_stories")
    .select("id, author_id, author_username, anonymous, title, body, status, created_at, admin_reply, admin_replied_at, author_reply, author_replied_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return { data: rows.map(mapStoryRow), error: null };
}

export async function adminDeleteStory(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("army_stories").delete().eq("id", id);
  return { error: error?.message ?? null };
}

