import { supabase } from "@/lib/supabaseClient";
import type { Chat, ChatMessage, ChatStatus } from "@/lib/ChatContext";

type DbChat = {
  id: string;
  request_id: string;
  ticket_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_username: string;
  seller_username: string;
  status: string;
  ticket_summary: string;
  created_at: string;
  closed_at: string | null;
};

type DbMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_username: string;
  text: string;
  image_url: string | null;
  created_at: string;
};

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function mapChat(d: DbChat): Chat {
  return {
    id: d.id,
    requestId: d.request_id,
    ticketId: d.ticket_id,
    buyerId: d.buyer_id,
    sellerId: d.seller_id,
    buyerUsername: d.buyer_username,
    sellerUsername: d.seller_username,
    status: d.status as ChatStatus,
    createdAt: toMs(d.created_at),
    closedAt: d.closed_at ? toMs(d.closed_at) : null,
    ticketSummary: d.ticket_summary,
  };
}

function mapMessage(d: DbMessage): ChatMessage {
  return {
    id: d.id,
    chatId: d.chat_id,
    senderId: d.sender_id,
    senderUsername: d.sender_username,
    text: d.text,
    imageUrl: d.image_url ?? undefined,
    createdAt: toMs(d.created_at),
  };
}

export async function fetchChatsForUser(
  userId: string
): Promise<{ data: Chat[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    const chats = (data ?? []).map((c) => mapChat(c as DbChat));
    chats.sort((a, b) => (b.closedAt ?? b.createdAt) - (a.closedAt ?? a.createdAt));
    return { data: chats, error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch chats",
    };
  }
}

export async function fetchMessagesForChat(
  chatId: string
): Promise<{ data: ChatMessage[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []).map((m) => mapMessage(m as DbMessage)), error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch messages",
    };
  }
}

export async function insertChat(params: {
  requestId: string;
  ticketId: string;
  buyerId: string;
  sellerId: string;
  buyerUsername: string;
  sellerUsername: string;
  ticketSummary: string;
}): Promise<{ data: Chat | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("chats")
      .insert({
        request_id: params.requestId,
        ticket_id: params.ticketId,
        buyer_id: params.buyerId,
        seller_id: params.sellerId,
        buyer_username: params.buyerUsername,
        seller_username: params.sellerUsername,
        ticket_summary: params.ticketSummary,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapChat(data as DbChat), error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to create chat",
    };
  }
}

export async function updateChatClosed(chatId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("chats")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", chatId);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to close chat" };
  }
}

/** Close all open chats for a ticket (e.g. when seller marks it sold). */
export async function closeAllChatsForTicket(
  ticketId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("chats")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("ticket_id", ticketId)
      .eq("status", "open");
    return { error: error?.message ?? null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to close chats for ticket",
    };
  }
}

export async function insertMessage(params: {
  chatId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  imageUrl?: string;
}): Promise<{ data: ChatMessage | null; error: string | null }> {
  try {
    const row: Record<string, unknown> = {
      chat_id: params.chatId,
      sender_id: params.senderId,
      sender_username: params.senderUsername,
      text: params.text,
    };
    if (params.imageUrl) row.image_url = params.imageUrl;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert(row)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: mapMessage(data as DbMessage), error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to send message",
    };
  }
}
