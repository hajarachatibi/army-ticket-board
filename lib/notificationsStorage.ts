const KEY_PREFIX = "army_pending_notifications_";

export type PendingNotification = {
  type:
    | "request_received"
    | "request_accepted"
    | "request_rejected"
    | "ticket_reported"
    | "new_message";
  ticketId?: string;
  requestId?: string;
  message?: string;
  /** Ticket basic info (e.g. "Event · City · Day") for display instead of ticket ID. */
  ticketSummary?: string;
};

export function pushPendingForUser(userId: string, n: PendingNotification): void {
  try {
    const key = KEY_PREFIX + userId;
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    const list: PendingNotification[] = raw ? JSON.parse(raw) : [];
    list.push(n);
    localStorage.setItem(key, JSON.stringify(list.slice(-50)));
  } catch {
    /* ignore */
  }
}

export function popPendingForUser(userId: string): PendingNotification[] {
  try {
    const key = KEY_PREFIX + userId;
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (!raw) return [];
    const list = JSON.parse(raw) as PendingNotification[];
    localStorage.removeItem(key);
    return list;
  } catch {
    return [];
  }
}
