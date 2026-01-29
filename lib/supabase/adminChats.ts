import { supabase } from "@/lib/supabaseClient";

export type AdminChat = {
  id: string;
  adminId: string;
  userId: string;
  createdAt: string;
  status: "open" | "closed";
  closedAt: string | null;
};

export type AdminChatListItem = {
  id: string;
  otherEmail: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastText: string | null;
  lastSenderUsername: string | null;
  lastSenderId: string | null;
  status: "open" | "closed";
  closedAt: string | null;
  isAdmin: boolean;
  otherShowAdminBadge: boolean;
};

export type AdminChatMessage = {
  id: string;
  adminChatId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  createdAt: string;
};

export async function fetchMyAdminChats(): Promise<{
  data: AdminChatListItem[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("get_my_admin_chats");
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as Array<{
      id: string;
      other_email: string | null;
      created_at: string;
      last_message_at: string | null;
      last_text: string | null;
      last_sender_username: string | null;
      last_sender_id: string | null;
      status: string | null;
      closed_at: string | null;
      is_admin: boolean;
      other_show_admin_badge: boolean;
    }>;
    return {
      data: rows.map((r) => ({
        id: r.id,
        otherEmail: r.other_email ?? "",
        createdAt: r.created_at,
        lastMessageAt: r.last_message_at,
        lastText: r.last_text,
        lastSenderUsername: r.last_sender_username ?? null,
        lastSenderId: r.last_sender_id ?? null,
        status: (r.status === "closed" ? "closed" : "open") as "open" | "closed",
        closedAt: r.closed_at ?? null,
        isAdmin: !!r.is_admin,
        otherShowAdminBadge: !!r.other_show_admin_badge,
      })),
      error: null,
    };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch admin chats",
    };
  }
}

export async function adminGetOrCreateChat(userId: string): Promise<{
  data: AdminChat | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc("admin_get_or_create_chat", {
      p_user_id: userId,
    });
    if (error) return { data: null, error: error.message };
    const raw = data as {
      id: string;
      admin_id: string;
      user_id: string;
      created_at: string;
      status?: string | null;
      closed_at?: string | null;
    } | null;
    if (!raw) return { data: null, error: "No chat returned" };
    return {
      data: {
        id: raw.id,
        adminId: raw.admin_id,
        userId: raw.user_id,
        createdAt: raw.created_at,
        status: raw.status === "closed" ? "closed" : "open",
        closedAt: raw.closed_at ?? null,
      },
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to get or create chat",
    };
  }
}

export async function fetchAdminChatMessages(adminChatId: string): Promise<{
  data: AdminChatMessage[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("admin_chat_messages")
      .select("*")
      .eq("admin_chat_id", adminChatId)
      .order("created_at", { ascending: true });
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as Array<{
      id: string;
      admin_chat_id: string;
      sender_id: string;
      sender_username: string;
      text: string;
      created_at: string;
    }>;
    return {
      data: rows.map((r) => ({
        id: r.id,
        adminChatId: r.admin_chat_id,
        senderId: r.sender_id,
        senderUsername: r.sender_username,
        text: r.text,
        createdAt: r.created_at,
      })),
      error: null,
    };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch messages",
    };
  }
}

export async function sendAdminChatMessage(params: {
  adminChatId: string;
  senderId: string;
  senderUsername: string;
  text: string;
}): Promise<{ data: AdminChatMessage | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("admin_chat_messages")
      .insert({
        admin_chat_id: params.adminChatId,
        sender_id: params.senderId,
        sender_username: params.senderUsername,
        text: params.text,
      })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    const r = data as {
      id: string;
      admin_chat_id: string;
      sender_id: string;
      sender_username: string;
      text: string;
      created_at: string;
    };
    return {
      data: {
        id: r.id,
        adminChatId: r.admin_chat_id,
        senderId: r.sender_id,
        senderUsername: r.sender_username,
        text: r.text,
        createdAt: r.created_at,
      },
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : "Failed to send message",
    };
  }
}

export async function updateAdminChatClosed(adminChatId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("admin_chats")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", adminChatId);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to stop chat" };
  }
}

export async function updateAdminChatReopened(adminChatId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("admin_chats")
      .update({ status: "open", closed_at: null })
      .eq("id", adminChatId);
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reactivate chat" };
  }
}
