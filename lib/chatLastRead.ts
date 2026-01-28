const KEY_PREFIX = "army_chat_last_read_";

function key(userId: string): string {
  return KEY_PREFIX + userId;
}

export function getLastReadAt(userId: string, chatId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, number>;
    return map[chatId] ?? 0;
  } catch {
    return 0;
  }
}

export function setLastReadAt(userId: string, chatId: string, at: number): void {
  if (typeof window === "undefined") return;
  try {
    const k = key(userId);
    const raw = localStorage.getItem(k);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, number>;
    map[chatId] = at;
    localStorage.setItem(k, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
