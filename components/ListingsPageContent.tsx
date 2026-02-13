"use client";

import { useState } from "react";
import ConnectionBoardView from "@/components/ConnectionBoardView";
import MerchBoardView from "@/components/MerchBoardView";
import { useAuth } from "@/lib/AuthContext";

type ListingsMode = "tickets" | "merch";

export default function ListingsPageContent() {
  const { isAdmin } = useAuth();
  const [mode, setMode] = useState<ListingsMode>("tickets");

  return (
    <>
      {/* Top-level tab: Tickets | Merch (Merch visible only to admins during testing) */}
      <div className="mb-6 inline-flex w-full max-w-xl rounded-2xl border border-army-purple/15 bg-white p-1 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
        <button
          type="button"
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
            mode === "tickets" ? "bg-army-purple text-white" : "text-army-purple hover:bg-army-purple/10"
          }`}
          onClick={() => setMode("tickets")}
        >
          Tickets
        </button>
        {isAdmin && (
          <button
            type="button"
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              mode === "merch" ? "bg-army-purple text-white" : "text-army-purple hover:bg-army-purple/10"
            }`}
            onClick={() => setMode("merch")}
          >
            Merch
          </button>
        )}
      </div>

      {mode === "tickets" && <ConnectionBoardView />}
      {mode === "merch" && isAdmin && <MerchBoardView />}
    </>
  );
}
