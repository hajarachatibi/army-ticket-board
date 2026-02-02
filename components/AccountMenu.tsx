"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useAuth } from "@/lib/AuthContext";

export default function AccountMenu() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const email = user.email ?? "";

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    const ok = confirm(
      "Delete your account?\n\nThis will permanently delete your profile and access. This cannot be undone."
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) {
        alert(j?.error || `Failed to delete account (HTTP ${res.status})`);
        return;
      }
      // In case the server sign-out didn't fully clear client state yet.
      await signOut().catch(() => null);
      router.push("/login");
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-army-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="font-semibold sm:hidden">Account</span>
        <span className="hidden max-w-[180px] truncate sm:inline" title={email}>
          {email}
        </span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-army-purple/20 bg-white shadow-xl dark:bg-neutral-900"
            role="menu"
          >
            <div className="border-b border-army-purple/15 px-3 py-2 text-sm dark:border-army-purple/25">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Signed in as
              </p>
              <p className="mt-1 truncate font-semibold text-army-purple" title={email}>
                {email}
              </p>
            </div>

            <div className="p-2">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-army-purple/5 dark:text-neutral-300 dark:hover:bg-army-purple/10"
                role="menuitem"
              >
                Settings
              </Link>

              <button
                type="button"
                onClick={handleDeleteAccount}
                className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-900/20"
                role="menuitem"
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete account"}
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-700 hover:bg-army-purple/5 dark:text-neutral-300 dark:hover:bg-army-purple/10"
                role="menuitem"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

