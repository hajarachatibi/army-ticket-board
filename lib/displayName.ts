export function maskEmail(raw: string): string {
  const s = (raw ?? "").trim();
  const at = s.indexOf("@");
  if (at <= 0) return s;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (!domain) return "***";

  const first = local.slice(0, 1) || "*";
  return `${first}***@${domain}`;
}

/**
 * Display rules:
 * - Viewer is admin: can see full raw.
 * - Viewer is not admin, subject is admin: show full raw (admin email is visible to all).
 * - Otherwise: if it's an email, mask it; else return as-is.
 */
export function displayName(raw: string, opts: { viewerIsAdmin: boolean; subjectIsAdmin?: boolean }): string {
  const s = (raw ?? "").trim();
  if (!s) return "User";
  if (opts.viewerIsAdmin) return s;
  if (opts.subjectIsAdmin) return s;
  return s.includes("@") ? maskEmail(s) : s;
}

