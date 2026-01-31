function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export type TurnstileVerifyResult = { ok: true } | { ok: false; error: string };

export async function verifyTurnstile(params: {
  token: string | null | undefined;
  ip?: string | null;
}): Promise<TurnstileVerifyResult> {
  const enabled = isTruthyEnv(process.env.ENABLE_TURNSTILE);
  if (!enabled) return { ok: true };

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, error: "Turnstile is enabled but TURNSTILE_SECRET_KEY is missing" };

  const token = (params.token ?? "").trim();
  if (!token) return { ok: false, error: "Missing Turnstile token" };

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (params.ip) form.append("remoteip", params.ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    if (!res.ok) return { ok: false, error: `Turnstile verify failed (HTTP ${res.status})` };
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data?.success) return { ok: true };
    const codes = Array.isArray(data?.["error-codes"]) ? data["error-codes"].join(", ") : "unknown";
    return { ok: false, error: `Turnstile failed: ${codes}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Turnstile verify failed" };
  }
}

