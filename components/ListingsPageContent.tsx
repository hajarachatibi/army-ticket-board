"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ConnectionBoardView from "@/components/ConnectionBoardView";
import MerchBoardView from "@/components/MerchBoardView";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";

type ListingsMode = "tickets" | "merch";

/** Emails that can see the Merch tab during testing (in addition to admins). */
const MERCH_TESTER_EMAILS = new Set([
  "achatibihajar1@gmail.com",
  "acwebdev1@gmail.com",
]);

function canSeeMerch(isAdmin: boolean, email: string | undefined): boolean {
  return isAdmin || (!!email && MERCH_TESTER_EMAILS.has(email.toLowerCase()));
}

export default function ListingsPageContent() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const initialMode: ListingsMode = modeParam === "merch" ? "merch" : "tickets";
  const { user, isAdmin } = useAuth();
  const [mode, setMode] = useState<ListingsMode>(initialMode);
  const showMerch = canSeeMerch(isAdmin, user?.email);

  const { notifications } = useNotifications();
  const unreadTicketConnectionCount = useMemo(
    () => notifications.filter((n) => !n.read && !!n.connectionId).length,
    [notifications]
  );
  const unreadMerchConnectionCount = useMemo(
    () => notifications.filter((n) => !n.read && !!n.merchConnectionId).length,
    [notifications]
  );

  useEffect(() => {
    const m = modeParam === "merch" ? "merch" : "tickets";
    setMode(m);
  }, [modeParam]);

  return (
    <>
      {/* Top-level tab: Tickets | Merch (Merch visible to admins and testers during testing) */}
      <div className="mb-6 inline-flex w-full max-w-xl rounded-2xl border border-army-purple/15 bg-white p-1 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
        <button
          type="button"
          className={`relative flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
            mode === "tickets" ? "bg-army-purple text-white" : "text-army-purple hover:bg-army-purple/10"
          }`}
          onClick={() => setMode("tickets")}
        >
          Tickets
          {unreadTicketConnectionCount > 0 && (
            <span
              className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                mode === "tickets" ? "bg-white text-army-purple" : "bg-army-purple text-white"
              }`}
              aria-label={`${unreadTicketConnectionCount} unread ticket connection updates`}
            >
              {unreadTicketConnectionCount > 99 ? "99+" : unreadTicketConnectionCount}
            </span>
          )}
        </button>
        {showMerch && (
          <button
            type="button"
            className={`relative flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              mode === "merch" ? "bg-army-purple text-white" : "text-army-purple hover:bg-army-purple/10"
            }`}
            onClick={() => setMode("merch")}
          >
            Merch
            {unreadMerchConnectionCount > 0 && (
              <span
                className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  mode === "merch" ? "bg-white text-army-purple" : "bg-army-purple text-white"
                }`}
                aria-label={`${unreadMerchConnectionCount} unread merch connection updates`}
              >
                {unreadMerchConnectionCount > 99 ? "99+" : unreadMerchConnectionCount}
              </span>
            )}
          </button>
        )}
      </div>

      {mode === "tickets" && <ConnectionBoardView />}
      {mode === "merch" && showMerch && <MerchBoardView />}
    </>
  );
}
