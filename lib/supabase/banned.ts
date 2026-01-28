const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Check if an email is banned. Uses authenticated request (pass token). */
export async function isBannedEmail(
  email: string,
  accessToken: string
): Promise<boolean> {
  if (!email?.trim()) return false;
  const url = `${SUPABASE_URL}/rest/v1/banned_users?email=eq.${encodeURIComponent(email.trim())}&select=email`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return false;
    const arr = (await res.json()) as unknown[];
    return Array.isArray(arr) && arr.length > 0;
  } catch {
    return false;
  }
}
