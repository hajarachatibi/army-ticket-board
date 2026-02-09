export type SocialField = "instagram" | "facebook";

function looksLikeEmail(s: string): boolean {
  // Allow "@handle" (no domain), but block actual emails.
  // Example blocked: "user@gmail.com"
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s);
}

function looksLikePhoneNumber(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 10) return true;
  if (digits.length >= 8 && /[+\-() ]/.test(s)) return true;
  return false;
}

function looksLikeLink(s: string): boolean {
  const v = s.toLowerCase().trim();
  if (!v) return false;
  // Protocol or www
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("www.")) return true;
  if (v.includes("http://") || v.includes("https://") || v.includes("www.")) return true;
  // URL path or backslash
  if (v.includes("/") || v.includes("\\")) return true;
  // Common TLDs (domain-like)
  if (v.includes(".com") || v.includes(".net") || v.includes(".org") || v.includes(".io") || v.includes(".co/") || v.includes(".me/")) return true;
  // Messaging / contact
  if (v.includes("whatsapp") || v.includes("wa.me") || v.includes("telegram") || v.includes("t.me") || v.includes("tg://") || v.includes("mailto:") || v.includes("email")) return true;
  return false;
}

export function validateSocialValue(field: SocialField, value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (looksLikeEmail(raw)) return `Please don’t put an email address in ${field}. Use your ${field} username only.`;
  if (looksLikePhoneNumber(raw)) return `Please don’t put a phone number in ${field}. Use your ${field} username only.`;
  if (looksLikeLink(raw)) return `Use your ${field} username only — no links or URLs.`;
  return null;
}

export function validateAllSocials(values: Record<SocialField, string>): string | null {
  const fields: SocialField[] = ["instagram", "facebook"];
  for (const f of fields) {
    const err = validateSocialValue(f, values[f] ?? "");
    if (err) return err;
  }
  return null;
}

