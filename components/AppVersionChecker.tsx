"use client";

import { useCallback, useEffect, useState } from "react";

const VERSION_KEY = "army_ticket_board_version";
const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

export default function AppVersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { version } = (await res.json()) as { version: string };
      const prev = typeof window !== "undefined" ? sessionStorage.getItem(VERSION_KEY) : null;
      const prevSet = prev != null && prev !== "";
      if (prevSet && prev !== version) {
        setUpdateAvailable(true);
        setDismissed(false);
      } else if (typeof window !== "undefined") {
        sessionStorage.setItem(VERSION_KEY, version);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);
    const onFocus = () => checkVersion();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkVersion();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkVersion]);

  const handleRefresh = useCallback(async () => {
    // Store current server version before reload so after refresh we don't show the banner again
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (res.ok) {
        const { version } = (await res.json()) as { version: string };
        if (version) sessionStorage.setItem(VERSION_KEY, version);
      }
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-army-purple/30 bg-white px-4 py-3 shadow-lg dark:border-army-purple/40 dark:bg-neutral-900 sm:left-auto sm:right-4 sm:max-w-sm"
      role="alert"
    >
      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
        New version available
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded-lg bg-army-purple px-3 py-1.5 text-sm font-semibold text-white hover:bg-army-purple/90"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
          aria-label="Dismiss"
        >
          Later
        </button>
      </div>
    </div>
  );
}
