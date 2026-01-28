import type { AuthSession } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function fetchProfileWithToken(
  userId: string,
  accessToken: string
): Promise<{ username: string; email: string } | null> {
  const url = `${SUPABASE_URL}/rest/v1/user_profiles?select=username,email&id=eq.${userId}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ username: string; email?: string | null }>;
    const row = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    if (!row) return null;
    return { username: row.username, email: row.email ?? "" };
  } catch {
    return null;
  }
}

async function insertUserProfile(
  userId: string,
  username: string,
  accessToken: string,
  email?: string | null
): Promise<{ data: Array<{ username: string; email?: string | null }> | null; error: { message: string } | null }> {
  const url = `${SUPABASE_URL}/rest/v1/user_profiles?select=username,email`;
  const body: { id: string; username: string; email?: string; role: string } = {
    id: userId,
    username,
    role: "user",
  };
  if (email != null && email !== "") body.email = email;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const data = (await res.json()) as Array<{ username: string; email?: string | null }>;
    return { data, error: null };
  }
  let message = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string };
    if (typeof j?.message === "string") message = j.message;
  } catch {
    /* ignore */
  }
  return { data: null, error: { message } };
}

function usernameFromGoogle(session: AuthSession): string {
  const email = session.user.email?.trim();
  return email || `user-${session.user.id.slice(0, 8)}`;
}

/** Ensure user_profiles row exists for this session. Create from Google metadata if missing. */
export async function ensureGoogleProfile(session: AuthSession): Promise<{ username: string; email: string }> {
  const userId = session.user.id;
  const email = session.user.email ?? "";
  const username = usernameFromGoogle(session);
  const token = session.access_token;

  const existing = await fetchProfileWithToken(userId, token);
  if (existing) return { username: existing.username, email: existing.email };

  const { data, error } = await insertUserProfile(userId, username, token, email);
  if (error) {
    const isConflict = /409|23505|unique|duplicate|conflict/i.test(error.message);
    if (isConflict) {
      const p = await fetchProfileWithToken(userId, token);
      if (p) return p;
      return { username, email };
    }
    throw new Error(error.message);
  }
  const row = Array.isArray(data) && data[0] ? data[0] : null;
  if (row) return { username: row.username, email: row.email ?? email };
  return { username, email };
}
