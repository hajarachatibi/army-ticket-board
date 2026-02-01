import type { NextRequest } from "next/server";

/**
 * Best-effort client IP extraction behind proxies/CDNs.
 * CDNs/proxies: True-Client-IP / X-Forwarded-For / X-Real-IP
 * Standard: X-Forwarded-For
 */
export function getRequestIp(request: NextRequest): string | null {
  const tci = request.headers.get("true-client-ip");
  if (tci && tci.trim()) return tci.split(",")[0]!.trim();

  const xf = request.headers.get("x-forwarded-for");
  if (xf && xf.trim()) return xf.split(",")[0]!.trim();

  const xr = request.headers.get("x-real-ip");
  if (xr && xr.trim()) return xr.split(",")[0]!.trim();

  // NextRequest.ip exists in some runtimes.
  // @ts-expect-error - NextRequest.ip exists in some runtimes.
  return (request.ip as string | undefined) ?? null;
}

