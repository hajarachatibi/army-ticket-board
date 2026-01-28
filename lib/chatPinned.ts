const KEY_PREFIX = "army_chat_pinned_";
const MAX_PINNED = 3;

function storageKey(userId: string): string {
  return KEY_PREFIX + userId;
}

export function getPinnedChatIds(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function setPinnedChatIds(userId: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const limited = ids.slice(0, MAX_PINNED);
    localStorage.setItem(storageKey(userId), JSON.stringify(limited));
  } catch {
    /* ignore */
  }
}

export function togglePinned(
  userId: string,
  chatId: string,
  current: string[]
): { pinned: boolean; pinnedIds: string[] } {
  const i = current.indexOf(chatId);
  if (i >= 0) {
    const next = current.filter((id) => id !== chatId);
    setPinnedChatIds(userId, next);
    return { pinned: false, pinnedIds: next };
  }
  if (current.length >= MAX_PINNED) {
    return { pinned: false, pinnedIds: current };
  }
  const next = [...current, chatId];
  setPinnedChatIds(userId, next);
  return { pinned: true, pinnedIds: next };
}

export { MAX_PINNED };
