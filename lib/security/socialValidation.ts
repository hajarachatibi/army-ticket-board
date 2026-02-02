export type SocialField = "instagram" | "facebook" | "tiktok" | "snapchat";

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

function looksLikeMessagingOrLink(s: string): boolean {
  const v = s.toLowerCase();
  return (
    v.includes("whatsapp") ||
    v.includes("wa.me") ||
    v.includes("telegram") ||
    v.includes("t.me") ||
    v.includes("tg://") ||
    v.includes("mailto:") ||
    v.includes("email") ||
    v.includes("http://") ||
    v.includes("https://") ||
    v.includes("www.")
  );
}

export function validateSocialValue(field: SocialField, value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (looksLikeEmail(raw)) return `Please don’t put an email address in ${field}. Use your ${field} username only.`;
  if (looksLikePhoneNumber(raw)) return `Please don’t put a phone number in ${field}. Use your ${field} username only.`;
  if (looksLikeMessagingOrLink(raw)) return `Please don’t put WhatsApp/Telegram/links in ${field}. Use your ${field} username only.`;
  return null;
}

export function validateAllSocials(values: Record<SocialField, string>): string | null {
  const fields: SocialField[] = ["instagram", "facebook", "tiktok", "snapchat"];
  for (const f of fields) {
    const err = validateSocialValue(f, values[f] ?? "");
    if (err) return err;
  }
  return null;
}

