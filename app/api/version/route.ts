import { NextResponse } from "next/server";

/**
 * Returns a version string that changes on each deploy.
 * Used by the client to detect new deployments and prompt refresh.
 */
export async function GET() {
  const version =
    process.env.BUILD_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "dev";
  return NextResponse.json({ version }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
