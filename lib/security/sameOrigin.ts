import type { NextRequest } from "next/server";

/**
 * Basic CSRF mitigation for cookie-authenticated POST requests.
 *
 * - If Origin is present, require it to match Host.
 * - If Origin is missing (some non-browser clients), fall back to Sec-Fetch-Site when available.
 *
 * Returns an error string when the request should be rejected; otherwise null.
 */
export function sameOriginError(request: NextRequest): string | null {
  const host = request.headers.get("host");
  if (!host) return null; // can't validate; avoid false positives

  const origin = request.headers.get("origin");
  if (origin && origin.trim()) {
    try {
      const o = new URL(origin);
      if (o.host !== host) return "bad_origin";
    } catch {
      return "bad_origin";
    }
    return null;
  }

  // If Origin is missing, use fetch metadata when provided by the browser.
  const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return "bad_origin";
  }
  return null;
}

