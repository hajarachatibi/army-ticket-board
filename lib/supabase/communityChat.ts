import { supabase } from "@/lib/supabaseClient";

export type CommunityChatMessage = {
  id: string;
  userId: string;
  text: string;
  imageUrl: string | null;
  createdAt: string;
  authorDisplayName: string;
  authorIsAdmin: boolean;
  reactionCounts: Record<string, number> | null;
};

export async function fetchCommunityChatMessages(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ data: CommunityChatMessage[]; error: string | null }> {
  const { data, error } = await supabase.rpc("fetch_community_chat_messages", {
    p_limit: params?.limit ?? 50,
    p_offset: params?.offset ?? 0,
  });
  if (error) return { data: [], error: error.message };
  const raw = (data as any)?.data;
  const arr = Array.isArray(raw) ? raw : [];
  return {
    data: arr.map((r: any) => ({
      id: String(r.id),
      userId: String(r.user_id),
      text: String(r.text ?? ""),
      imageUrl: typeof r.image_url === "string" && r.image_url.trim() ? r.image_url : null,
      createdAt: String(r.created_at),
      authorDisplayName: String(r.author_display_name ?? "User"),
      authorIsAdmin: Boolean(r.author_is_admin),
      reactionCounts: r.reaction_counts && typeof r.reaction_counts === "object" ? r.reaction_counts : null,
    })),
    error: null,
  };
}

export async function sendCommunityMessage(params: {
  userId: string;
  text: string;
  imageUrl?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("community_chat_messages").insert({
    user_id: params.userId,
    text: params.text.trim() || " ",
    image_url: params.imageUrl ?? null,
  });
  return { error: error?.message ?? null };
}

export async function setChatUsername(userId: string, username: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("user_profiles")
    .update({ chat_username: username.trim() })
    .eq("id", userId);
  return { error: error?.message ?? null };
}

const COMMUNITY_EMOJIS = ["💜", "😂", "👎"] as const;

export function getCommunityReactionEmojis(): readonly string[] {
  return COMMUNITY_EMOJIS;
}

export async function toggleCommunityReaction(params: {
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<{ error: string | null }> {
  const { error: insErr } = await supabase.from("community_chat_reactions").insert({
    message_id: params.messageId,
    user_id: params.userId,
    emoji: params.emoji,
  });
  if (!insErr) return { error: null };
  const isConflict = /duplicate|unique|23505|conflict/i.test(insErr.message);
  if (!isConflict) return { error: insErr.message };
  const { error: delErr } = await supabase
    .from("community_chat_reactions")
    .delete()
    .eq("message_id", params.messageId)
    .eq("user_id", params.userId)
    .eq("emoji", params.emoji);
  return { error: delErr?.message ?? null };
}
