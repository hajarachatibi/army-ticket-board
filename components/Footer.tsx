"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export default function Footer() {
  const year = new Date().getFullYear();
  const { isLoggedIn } = useAuth();
  const supportEnabled = isTruthyEnv(process.env.NEXT_PUBLIC_ENABLE_SUPPORT_PAGE);
  return (
    <footer className="mt-auto border-t border-army-purple/10 bg-white/80 py-6 dark:bg-[#0f0f0f]/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">© {year} Army Ticket Board. Made by Army, for Army.</p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link href="/privacy-policy" className="text-army-purple hover:underline dark:text-army-300">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-army-purple hover:underline dark:text-army-300">
              Terms
            </Link>
            {supportEnabled && isLoggedIn && (
              <Link href="/support" className="text-army-purple hover:underline dark:text-army-300">
                Support us 💜
              </Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
