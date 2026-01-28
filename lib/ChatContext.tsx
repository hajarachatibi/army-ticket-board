"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/lib/AuthContext";
import { getLastReadAt, setLastReadAt as setLastReadAtStorage } from "@/lib/chatLastRead";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchChatsForUser as fetchChatsForUserApi,
  fetchMessagesForChat as fetchMessagesForChatApi,
  insertChat as insertChatApi,
  insertMessage as insertMessageApi,
  updateChatClosed as updateChatClosedApi,
} from "@/lib/supabase/chats";

export type ChatStatus = "open" | "closed";

export type Chat = {
  id: string;
  requestId: string;
  ticketId: string;
  buyerId: string;
  sellerId: string;
  buyerUsername: string;
  sellerUsername: string;
  status: ChatStatus;
  createdAt: number;
  closedAt: number | null;
  ticketSummary: string;
};

export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  imageUrl?: string;
  createdAt: number;
};

type ChatContextValue = {
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  activeChatId: string | null;
  fetchChatsForUser: (userId: string) => Promise<void>;
  fetchMessagesForChat: (chatId: string) => Promise<void>;
  createChat: (params: {
    requestId: string;
    ticketId: string;
    buyerId: string;
    sellerId: string;
    buyerUsername: string;
    sellerUsername: string;
    ticketSummary: string;
  }) => Promise<Chat | null>;
  closeChat: (chatId: string) => Promise<void>;
  addMessage: (
    chatId: string,
    senderId: string,
    senderUsername: string,
    text: string,
    imageUrl?: string
  ) => Promise<ChatMessage | null>;
  getChatsForUser: (userId: string) => Chat[];
  getMessagesForChat: (chatId: string) => ChatMessage[];
  getChatById: (chatId: string) => Chat | null;
  getOpenChatForTicket: (ticketId: string, userId: string) => Chat | null;
  getOpenChatsForTicket: (ticketId: string) => Chat[];
  getUnreadCount: (chatId: string) => number;
  getUnreadChatsCount: (userId: string) => number;
  openChatModal: (chatId: string) => void;
  closeChatModal: () => void;
  setLastReadAt: (chatId: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [lastReadAtByChat, setLastReadAtByChat] = useState<Record<string, number>>({});

  const fetchChatsForUser = useCallback(async (userId: string) => {
    const { data, error } = await fetchChatsForUserApi(userId);
    if (error) {
      if (process.env.NODE_ENV === "development") console.error("[ChatContext] fetchChatsForUser:", error);
      return;
    }
    setChats(data);
  }, []);

  const fetchMessagesForChat = useCallback(async (chatId: string) => {
    const { data, error } = await fetchMessagesForChatApi(chatId);
    if (error) {
      if (process.env.NODE_ENV === "development") console.error("[ChatContext] fetchMessagesForChat:", error);
      return;
    }
    setMessagesByChat((prev) => ({ ...prev, [chatId]: data }));
  }, []);

  useEffect(() => {
    if (user) void fetchChatsForUser(user.id);
  }, [user?.id, fetchChatsForUser]);

  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;
    try {
      const k = "army_chat_last_read_" + user.id;
      const raw = localStorage.getItem(k);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, number>;
      setLastReadAtByChat(map);
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const chatIdsKey = useMemo(
    () => chats.map((c) => c.id).sort().join(","),
    [chats]
  );
  useEffect(() => {
    if (!user?.id || !chatIdsKey) return;
    chatIdsKey.split(",").forEach((id) => void fetchMessagesForChat(id));
  }, [user?.id, chatIdsKey, fetchMessagesForChat]);

  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;
    const channelName = "chat_messages_realtime";
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            chat_id: string;
            sender_id: string;
            sender_username: string;
            text: string;
            image_url: string | null;
            created_at: string;
          };
          const chatId = row.chat_id;
          const msg: ChatMessage = {
            id: row.id,
            chatId,
            senderId: row.sender_id,
            senderUsername: row.sender_username,
            text: row.text,
            imageUrl: row.image_url ?? undefined,
            createdAt: new Date(row.created_at).getTime(),
          };
          setMessagesByChat((prev) => {
            const list = prev[chatId] ?? [];
            if (list.some((m) => m.id === msg.id)) return prev;
            return { ...prev, [chatId]: [...list, msg] };
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const createChat = useCallback(
    async (params: {
      requestId: string;
      ticketId: string;
      buyerId: string;
      sellerId: string;
      buyerUsername: string;
      sellerUsername: string;
      ticketSummary: string;
    }): Promise<Chat | null> => {
      const { data, error } = await insertChatApi(params);
      if (error) {
        if (process.env.NODE_ENV === "development") console.error("[ChatContext] createChat:", error);
        return null;
      }
      if (data) {
        setChats((prev) => [data, ...prev]);
        return data;
      }
      return null;
    },
    []
  );

  const closeChat = useCallback(async (chatId: string) => {
    const { error } = await updateChatClosedApi(chatId);
    if (error) {
      if (process.env.NODE_ENV === "development") console.error("[ChatContext] closeChat:", error);
      return;
    }
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, status: "closed" as const, closedAt: Date.now() } : c
      )
    );
  }, []);

  const addMessage = useCallback(
    async (
      chatId: string,
      senderId: string,
      senderUsername: string,
      text: string,
      imageUrl?: string
    ): Promise<ChatMessage | null> => {
      const { data, error } = await insertMessageApi({
        chatId,
        senderId,
        senderUsername,
        text,
        imageUrl,
      });
      if (error) {
        if (process.env.NODE_ENV === "development") console.error("[ChatContext] addMessage:", error);
        return null;
      }
      if (data) {
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: [...(prev[chatId] ?? []), data],
        }));
        return data;
      }
      return null;
    },
    []
  );

  const getChatsForUser = useCallback(
    (userId: string) => {
      const list = chats.filter((c) => c.buyerId === userId || c.sellerId === userId);
      const lastMsgAt = (c: Chat) => {
        const msgs = messagesByChat[c.id] ?? [];
        if (msgs.length) return Math.max(...msgs.map((m) => m.createdAt));
        return c.closedAt ?? c.createdAt;
      };
      return list.sort((a, b) => lastMsgAt(b) - lastMsgAt(a));
    },
    [chats, messagesByChat]
  );

  const getMessagesForChat = useCallback(
    (chatId: string) =>
      [...(messagesByChat[chatId] ?? [])].sort((a, b) => a.createdAt - b.createdAt),
    [messagesByChat]
  );

  const getChatById = useCallback(
    (chatId: string) => chats.find((c) => c.id === chatId) ?? null,
    [chats]
  );

  const getOpenChatForTicket = useCallback(
    (ticketId: string, userId: string): Chat | null =>
      chats.find(
        (c) =>
          c.ticketId === ticketId &&
          c.status === "open" &&
          (c.buyerId === userId || c.sellerId === userId)
      ) ?? null,
    [chats]
  );

  const getOpenChatsForTicket = useCallback(
    (ticketId: string) => chats.filter((c) => c.ticketId === ticketId && c.status === "open"),
    [chats]
  );

  const openChatModal = useCallback((chatId: string) => {
    setActiveChatId(chatId);
  }, []);

  const closeChatModal = useCallback(() => setActiveChatId(null), []);

  const setLastReadAt = useCallback(
    (chatId: string) => {
      if (!user?.id) return;
      const at = Date.now();
      setLastReadAtByChat((prev) => ({ ...prev, [chatId]: at }));
      setLastReadAtStorage(user.id, chatId, at);
    },
    [user?.id]
  );

  const getUnreadCount = useCallback(
    (chatId: string): number => {
      if (!user?.id) return 0;
      const msgs = messagesByChat[chatId] ?? [];
      const last = lastReadAtByChat[chatId] ?? getLastReadAt(user.id, chatId);
      return msgs.filter((m) => m.senderId !== user.id && m.createdAt > last).length;
    },
    [user?.id, messagesByChat, lastReadAtByChat]
  );

  const getUnreadChatsCount = useCallback(
    (userId: string): number => {
      const list = getChatsForUser(userId);
      return list.filter((c) => getUnreadCount(c.id) > 0).length;
    },
    [getChatsForUser, getUnreadCount]
  );

  const value = useMemo(
    () => ({
      chats,
      messagesByChat,
      activeChatId,
      fetchChatsForUser,
      fetchMessagesForChat,
      createChat,
      closeChat,
      addMessage,
      getChatsForUser,
      getMessagesForChat,
      getChatById,
      getOpenChatForTicket,
      getOpenChatsForTicket,
      getUnreadCount,
      getUnreadChatsCount,
      openChatModal,
      closeChatModal,
      setLastReadAt,
    }),
    [
      chats,
      messagesByChat,
      activeChatId,
      lastReadAtByChat,
      fetchChatsForUser,
      fetchMessagesForChat,
      createChat,
      closeChat,
      addMessage,
      getChatsForUser,
      getMessagesForChat,
      getChatById,
      getOpenChatForTicket,
      getOpenChatsForTicket,
      getUnreadCount,
      getUnreadChatsCount,
      openChatModal,
      closeChatModal,
      setLastReadAt,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
