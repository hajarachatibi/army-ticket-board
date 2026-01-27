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
  openChatModal: (chatId: string) => void;
  closeChatModal: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

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
    (userId: string) =>
      chats
        .filter((c) => c.buyerId === userId || c.sellerId === userId)
        .sort((a, b) => (b.closedAt ?? b.createdAt) - (a.closedAt ?? a.createdAt)),
    [chats]
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
      openChatModal,
      closeChatModal,
    }),
    [
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
      openChatModal,
      closeChatModal,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
