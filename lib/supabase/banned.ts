const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Check if an email is banned. Uses authenticated request (pass token). */
export async function isBannedEmail(
  email: string,
  accessToken: string
): Promise<boolean> {
  if (!email?.trim()) return false;
  const url = `${SUPABASE_URL}/rest/v1/rpc/is_email_banned`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ p_email: email.trim() }),
    });
    if (!res.ok) return false;
    const val = (await res.json()) as unknown;
    return val === true;
  } catch {
    return false;
  }
}
