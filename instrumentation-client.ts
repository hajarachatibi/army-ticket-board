import { initBotId } from "botid/client/core";

// Runs before React hydration (Next.js instrumentation-client).
// Keep this lightweight and fail-safe.
try {
  initBotId({
    protect: [
      { path: "/api/tickets/create", method: "POST" },
      { path: "/api/requests/create", method: "POST" },
      { path: "/api/reports/ticket", method: "POST" },
      { path: "/api/reports/user", method: "POST" },
      { path: "/api/forum/submit", method: "POST" },
    ],
  });
} catch {
  // Never break the app if BotID fails to initialize.
}

