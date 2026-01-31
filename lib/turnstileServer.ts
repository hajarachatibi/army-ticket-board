function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export type TurnstileVerifyResult = { ok: true } | { ok: false; error: string };

/**
 * Server-side Turnstile verification helper.
 * Returns true if verification succeeds, false otherwise.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null
): Promise<boolean> {
  const enabled = isTruthyEnv(process.env.ENABLE_TURNSTILE);
  if (!enabled) return true;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;

  const t = (token ?? "").trim();
  if (!t) return false;

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", t);
  if (ip) form.append("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return data?.success === true;
  } catch (e) {
    return false;
  }
}

// Backwards-compatible wrapper used by older call sites in this repo.
export async function verifyTurnstileResult(params: {
  token: string | null | undefined;
  ip?: string | null;
}): Promise<TurnstileVerifyResult> {
  const ok = await verifyTurnstile(params.token, params.ip);
  return ok ? { ok: true } : { ok: false, error: "Turnstile verification failed" };
}

