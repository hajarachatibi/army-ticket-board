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
  | "ticket_reported"
  | "ticket_approved"
  | "ticket_rejected"
  | "connection_request_received"
  | "connection_request_accepted"
  | "connection_request_declined"
  | "connection_on_waiting_list"
  | "connection_bonding_submitted"
  | "connection_preview_ready"
  | "connection_comfort_updated"
  | "connection_social_updated"
  | "connection_agreement_updated"
  | "connection_match_confirmed"
  | "connection_ended"
  | "connection_expired"
  | "listing_removed_3_reports"
  | "listing_removed_by_admin"
  | "story_published"
  | "story_admin_replied";

export type Notification = {
  id: string;
  type: NotificationType;
  ticketId?: string;
  requestId?: string;
  listingId?: string;
  listingSummary?: string;
  connectionId?: string;
  message?: string;
  /** Ticket basic info (e.g. "Event · City · Day") for display instead of ticket ID. */
  ticketSummary?: string;
  /** Main report reasons when type = listing_removed_3_reports (comma-separated). */
  reportReasons?: string;
  /** Story ID when type = story_published or story_admin_replied. */
  storyId?: string;
  read: boolean;
  createdAt: number;
};

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  add: (n: Omit<Notification, "id" | "read" | "createdAt">) => void;
  /** Replace the in-app list with notifications from the DB (e.g. after refetch so list stays in sync). */
  replaceWithDbList: (list: Notification[]) => void;
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

  const replaceWithDbList = useCallback((list: Notification[]) => {
    setNotifications(list.slice(0, 50));
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, add, replaceWithDbList, markRead, markAllRead }),
    [notifications, unreadCount, add, replaceWithDbList, markRead, markAllRead]
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
