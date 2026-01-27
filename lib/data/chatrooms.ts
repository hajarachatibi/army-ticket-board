import { supabase } from "@/lib/supabaseClient";

export type ChatMessage = {
  id: string;
  chatroom_id?: string;
  ticket_id?: string;
  author: string;
  text: string;
  created_at?: string;
};

export async function fetchMessagesByTicket(
  ticketId: string
): Promise<{ data: ChatMessage[]; error: string | null }> {
  try {
    const { data: rooms } = await supabase
      .from("chatrooms")
      .select("id")
      .eq("ticket_id", ticketId)
      .limit(1);

    const roomId = rooms?.[0]?.id;
    if (!roomId) return { data: [], error: null };

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, chatroom_id, author, text, created_at")
      .eq("chatroom_id", roomId)
      .order("created_at", { ascending: true });

    if (error) return { data: [], error: error.message };

    const mapped: ChatMessage[] = (data ?? []).map((r) => ({
      id: String(r.id),
      chatroom_id: r.chatroom_id != null ? String(r.chatroom_id) : undefined,
      author: String(r.author ?? "Unknown"),
      text: String(r.text ?? ""),
      created_at: r.created_at != null ? String(r.created_at) : undefined,
    }));

    return { data: mapped, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Failed to fetch messages" };
  }
}

export const PLACEHOLDER_MESSAGES: ChatMessage[] = [
  { id: "1", author: "ARMY_Seoul", text: "Is this ticket still available?", created_at: "10:32" },
  { id: "2", author: "You", text: "Yes! Section A, row 5.", created_at: "10:35" },
  { id: "3", author: "ARMY_Seoul", text: "Perfect, I'd like to request it.", created_at: "10:36" },
  { id: "4", author: "You", text: "Sure, use the Request button and we'll sort it out.", created_at: "10:38" },
];
