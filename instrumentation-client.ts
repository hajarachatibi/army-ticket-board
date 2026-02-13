import { initBotId } from "botid/client/core";

// Runs before React hydration (Next.js instrumentation-client).
// Keep this lightweight and fail-safe.
try {
  initBotId({
    protect: [
      { path: "/api/tickets/create", method: "POST" },
      { path: "/api/tickets/proofs", method: "POST" },
      { path: "/api/listings/create", method: "POST" },
      { path: "/api/requests/create", method: "POST" },
      { path: "/api/reports/ticket", method: "POST" },
      { path: "/api/reports/listing", method: "POST" },
      { path: "/api/reports/user", method: "POST" },
      { path: "/api/onboarding/complete", method: "POST" },
      { path: "/api/listings/mark-sold", method: "POST" },
      { path: "/api/listings/mark-not-sold", method: "POST" },
      { path: "/api/merch-listings/mark-sold", method: "POST" },
      { path: "/api/listings/update", method: "POST" },
      { path: "/api/listings/delete", method: "POST" },
    ],
  });
} catch {
  // Never break the app if BotID fails to initialize.
}

