"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NotificationType =
  | "request_accepted"
  | "request_rejected"
  | "request_received"
  | "chat_opened"
  | "new_message"
  | "ticket_reported";

export type Notification = {
  id: string;
  type: NotificationType;
  ticketId?: string;
  requestId?: string;
  message?: string;
  /** Ticket basic info (e.g. "Event · City · Day") for display instead of ticket ID. */
  ticketSummary?: string;
  read: boolean;
  createdAt: number;
};

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  add: (n: Omit<Notification, "id" | "read" | "createdAt">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);
let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `n-${idCounter}-${Date.now()}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const add = useCallback((n: Omit<Notification, "id" | "read" | "createdAt">) => {
    const item: Notification = {
      ...n,
      id: nextId(),
      read: false,
      createdAt: Date.now(),
    };
    setNotifications((prev) => [item, ...prev].slice(0, 50));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, add, markRead, markAllRead }),
    [notifications, unreadCount, add, markRead, markAllRead]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
