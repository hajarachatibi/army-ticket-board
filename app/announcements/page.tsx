"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/AuthContext";
import { fetchAdminMessagesForUser } from "@/lib/supabase/admin";

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

export default function AnnouncementsPage() {
  const { user, isLoggedIn } = useAuth();
  const [messages, setMessages] = useState<Array<{ id: string; message: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchAdminMessagesForUser(user.id);
    setLoading(false);
    if (e) setError(e);
    else if (data) setMessages(data);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-bold text-army-purple">Announcements</h1>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            Please <Link href="/login" className="font-semibold text-army-purple hover:underline">sign in</Link> to view
            messages from admins.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-army-subtle">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-army-purple">Announcements</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Messages from the Army Ticket Board team.
        </p>

        {error && (
          <div
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            role="alert"
          >
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-center text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="mt-8 rounded-xl border border-army-purple/15 bg-white/80 px-4 py-8 text-center text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
            No announcements yet.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-army-purple/15 bg-white/80 p-4 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80"
              >
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{formatDate(m.createdAt)}</p>
                <p className="mt-2 whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">{m.message}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8">
          <Link href="/tickets" className="btn-army-outline">
            Back to Tickets
          </Link>
        </div>
      </div>
    </main>
  );
}
