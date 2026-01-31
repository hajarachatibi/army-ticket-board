import type { NextRequest } from "next/server";

/**
 * Best-effort client IP extraction behind proxies/CDNs.
 * Cloudflare: CF-Connecting-IP
 * Other CDNs: True-Client-IP
 * Standard: X-Forwarded-For
 */
export function getRequestIp(request: NextRequest): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.split(",")[0]!.trim();

  const tci = request.headers.get("true-client-ip");
  if (tci && tci.trim()) return tci.split(",")[0]!.trim();

  const xf = request.headers.get("x-forwarded-for");
  if (xf && xf.trim()) return xf.split(",")[0]!.trim();

  // NextRequest.ip exists in some runtimes.
  // @ts-expect-error - NextRequest.ip exists in some runtimes.
  return (request.ip as string | undefined) ?? null;
}

