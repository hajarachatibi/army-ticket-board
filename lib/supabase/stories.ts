import { supabase } from "@/lib/supabaseClient";

export type StoryReply = {
  id: string;
  replyType: "admin" | "author";
  body: string;
  createdAt: string;
};

export type ArmyStory = {
  id: string;
  authorId: string;
  authorUsername: string;
  anonymous: boolean;
  title: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  /** Server-computed display name (masked for non-admins; only set when fetching via get_approved_stories). */
  authorDisplayName?: string | null;
  /** Replies (admin and author) in chronological order. Only set when fetching via get_approved_stories. */
  replies?: StoryReply[];
};

function parseReplies(json: unknown): StoryReply[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((r) => r && typeof r === "object" && r.body != null)
    .map((r: any) => ({
      id: String(r.id ?? ""),
      replyType: r.reply_type === "author" ? "author" : "admin",
      body: String(r.body ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));
}

const mapStoryRow = (r: any): ArmyStory => ({
  id: String(r.id),
  authorId: String(r.author_id),
  authorUsername: String(r.author_username ?? "ARMY"),
  anonymous: Boolean(r.anonymous),
  title: String(r.title ?? ""),
  body: String(r.body ?? ""),
  status: (String(r.status ?? "approved") as ArmyStory["status"]),
  createdAt: String(r.created_at),
  authorDisplayName: r.display_author != null ? String(r.display_author) : undefined,
  replies: r.replies != null ? parseReplies(r.replies) : [],
});

/** Fetches approved stories with display_author and replies (emails protected; only admins and story owner see full identity). */
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
      authorDisplayName: r.display_author != null ? String(r.display_author) : "ARMY",
      replies: parseReplies(r.replies),
    })),
    error: null,
  };
}

/** Story owner adds a reply on their own approved story (unlimited). */
export async function addStoryReplyAuthor(storyId: string, body: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("add_story_reply_author", {
    p_story_id: storyId,
    p_body: body ?? "",
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
    .select("id, author_id, author_username, anonymous, title, body, status, created_at")
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
  const { error } = await supabase.from("army_stories").update({ status: params.status }).eq("id", params.id);
  if (error) return { error: error.message };
  const firstReply = params.adminReply?.trim();
  if (params.status === "approved" && firstReply) {
    const { error: replyError } = await addStoryReplyAdmin(params.id, firstReply);
    return { error: replyError ?? null };
  }
  return { error: null };
}

/** Admin adds a reply to an approved story (unlimited); notifies story author. */
export async function addStoryReplyAdmin(storyId: string, body: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("add_story_reply_admin", {
    p_story_id: storyId,
    p_body: body ?? "",
  });
  return { error: error?.message ?? null };
}

/** Fetches approved stories with replies (uses get_approved_stories RPC). */
export async function adminFetchApprovedStories(): Promise<{ data: ArmyStory[]; error: string | null }> {
  return fetchApprovedStories();
}

export async function adminDeleteStory(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("army_stories").delete().eq("id", id);
  return { error: error?.message ?? null };
}

