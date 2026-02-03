import { supabase } from "@/lib/supabaseClient";

export type AdminChannelPost = {
  id: string;
  text: string;
  imageUrl: string | null;
  createdAt: string;
  authorId: string;
  authorUsername: string;
  authorEmail: string;
  authorIsAdmin: boolean;
  repliesCount: number;
  reactionsCount: number;
};

export async function fetchAdminChannelPosts(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ data: AdminChannelPost[]; error: string | null }> {
  const { data, error } = await supabase.rpc("fetch_admin_channel_posts", {
    p_limit: params?.limit ?? 20,
    p_offset: params?.offset ?? 0,
  });
  if (error) return { data: [], error: error.message };
  const rows = ((data as any)?.data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      text: String(r.text ?? ""),
      imageUrl: typeof r.image_url === "string" && r.image_url.trim() ? r.image_url : null,
      createdAt: String(r.created_at),
      authorId: String(r.author_id),
      authorUsername: String(r.author_username ?? "Admin"),
      authorEmail: String(r.author_email ?? ""),
      authorIsAdmin: Boolean(r.author_is_admin),
      repliesCount: Number(r.replies_count ?? 0),
      reactionsCount: Number(r.reactions_count ?? 0),
    })),
    error: null,
  };
}

export async function adminCreateChannelPost(params: {
  authorId: string;
  text: string;
  imageUrl?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("admin_channel_posts").insert({
    author_id: params.authorId,
    text: params.text,
    image_url: params.imageUrl ?? null,
  });
  return { error: error?.message ?? null };
}

export async function adminUpdateChannelPost(params: {
  postId: string;
  text: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("admin_channel_posts").update({ text: params.text }).eq("id", params.postId);
  return { error: error?.message ?? null };
}

export async function fetchChannelReplies(postId: string): Promise<{
  data: Array<{ id: string; postId: string; userId: string; text: string; createdAt: string; username: string; role: string }>;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("get_admin_channel_replies", { p_post_id: postId });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r: any) => ({
      id: String(r.id),
      postId: String(r.post_id),
      userId: String(r.user_id),
      text: String(r.text ?? ""),
      createdAt: String(r.created_at),
      username: String(r.display_label ?? "User"),
      role: String(r.role ?? "user"),
    })),
    error: null,
  };
}

export async function addChannelReply(params: { postId: string; userId: string; text: string }): Promise<{ error: string | null }> {
  const { error } = await supabase.from("admin_channel_replies").insert({
    post_id: params.postId,
    user_id: params.userId,
    text: params.text,
  });
  return { error: error?.message ?? null };
}

export async function toggleChannelReaction(params: { postId: string; userId: string; emoji: string }): Promise<{ error: string | null }> {
  // naive toggle: try insert; if conflict, delete
  const { error: insErr } = await supabase.from("admin_channel_reactions").insert({
    post_id: params.postId,
    user_id: params.userId,
    emoji: params.emoji,
  });
  if (!insErr) return { error: null };
  const isConflict = /duplicate|unique|23505|conflict/i.test(insErr.message);
  if (!isConflict) return { error: insErr.message };
  const { error: delErr } = await supabase
    .from("admin_channel_reactions")
    .delete()
    .eq("post_id", params.postId)
    .eq("user_id", params.userId)
    .eq("emoji", params.emoji);
  return { error: delErr?.message ?? null };
}

