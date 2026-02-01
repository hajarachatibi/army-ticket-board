"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import { useTheme } from "@/lib/ThemeContext";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/tickets", label: "Tickets" },
  { href: "/chats", label: "Chats" },
  { href: "/stories", label: "Stories" },
  { href: "/disclaimers", label: "Disclaimers" },
  { href: "/user-manual", label: "User manual" },
];

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const { user, isLoggedIn, isAdmin, signOut } = useAuth();
  const { getUnreadChatsCount } = useChat();
  const unreadChatsCount = isLoggedIn && user ? getUnreadChatsCount(user.id) : 0;
  const showAdmin = isLoggedIn && isAdmin;
  const [mobileAnnouncementOpen, setMobileAnnouncementOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const supportEnabled = isTruthyEnv(process.env.NEXT_PUBLIC_ENABLE_SUPPORT_PAGE);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Auto-open only on mobile, once per session.
    if (window.innerWidth >= 640) return;
    const KEY = "army_safety_mobile_popup_v1_dismissed";
    if (window.sessionStorage.getItem(KEY) !== "1") setMobileAnnouncementOpen(true);
  }, []);

  const closeMobileAnnouncement = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("army_safety_mobile_popup_v1_dismissed", "1");
    }
    setMobileAnnouncementOpen(false);
  };

  const topMobileLinks = useMemo(() => {
    const base = [
      { href: "/tickets", label: "Tickets" },
      { href: "/chats", label: "Chats" },
    ];
    if (showAdmin) base.push({ href: "/admin", label: "Admin" });
    return base;
  }, [showAdmin]);

  const overflowMobileLinks = useMemo(() => {
    const allowed = new Set(topMobileLinks.map((x) => x.href));
    return NAV.filter((x) => !allowed.has(x.href));
  }, [topMobileLinks]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-army-purple/10 bg-white/95 shadow-header backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-army-purple/20 dark:bg-[#0f0f0f]/95 dark:supports-[backdrop-filter]:bg-[#0f0f0f]/80">
      {/* Ticket review notice */}
      <div className="border-b border-army-purple/20 bg-gradient-to-r from-army-purple to-army-700 px-4 py-2 text-white shadow-sm dark:border-army-purple/30">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center text-xs font-semibold sm:text-sm">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            Safety update
          </span>
          <div className="flex items-center gap-2 text-white/95">
            <span>
              We’re temporarily taking down all available tickets while admins review them. Approved tickets will be re-listed soon.
              <span className="hidden sm:inline">
                {" "}If you’re a seller with a pending ticket, please submit your seller proof form — you’ll find it under <strong>My tickets</strong>. We will temporarily keep the seller proof form only for pending tickets, but for all new tickets it’s merged into the Sell Ticket form.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setMobileAnnouncementOpen(true)}
              className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-white/20 sm:hidden"
            >
              Details
            </button>
          </div>
        </div>
      </div>

      {/* Scam warning */}
      <div className="border-b border-red-500/30 bg-gradient-to-r from-red-600 to-amber-500 px-4 py-2 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center text-xs font-semibold sm:text-sm">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            Scam alert
          </span>
          <div className="flex items-center gap-2 text-white/95">
            <span>
              Admins will never ask for ticket transfer, order numbers, or payment info.
              <span className="hidden sm:inline">
                {" "}Hajar (achatibihajar@gmail.com) and Tom (tomkoods2020@gmail.com) are the only admins right now. We haven't sent any emails to any of the users, and we are not sending anything now. Please don't reply to scammers.
                {" "}If someone claims they’re an admin, check for the blue verified <strong>Admin</strong> badge. If there’s no badge (or the message feels suspicious), use the <strong>Report</strong> button inside the chat.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setMobileAnnouncementOpen(true)}
              className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-white/20 sm:hidden"
            >
              Details
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 font-display text-xl font-bold tracking-tight text-army-purple transition-colors hover:text-army-800 dark:hover:text-army-300"
          >
            <span className="hidden sm:inline">Army Ticket Board</span>
            <span className="sm:hidden">ATB</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map(({ href, label }) => {
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
              const showChatBadge = href === "/chats" && unreadChatsCount > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative inline-flex rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-army-purple/10 text-army-purple dark:bg-army-purple/20"
                      : "text-neutral-600 hover:bg-army-purple/5 hover:text-army-purple dark:text-neutral-400 dark:hover:bg-army-purple/10 dark:hover:text-army-300"
                  }`}
                >
                  {label}
                  {showChatBadge && (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-army-purple px-1 text-[10px] font-bold text-white"
                      aria-label={`${unreadChatsCount} new discussion${unreadChatsCount !== 1 ? "s" : ""}`}
                    >
                      {unreadChatsCount > 99 ? "99+" : unreadChatsCount}
                    </span>
                  )}
                </Link>
              );
            })}
            {showAdmin && (
              <Link
                href="/admin"
                className={`inline-flex rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  pathname === "/admin" || pathname.startsWith("/admin/")
                    ? "bg-army-purple/10 text-army-purple dark:bg-army-purple/20"
                    : "text-neutral-600 hover:bg-army-purple/5 hover:text-army-purple dark:text-neutral-400 dark:hover:bg-army-purple/10 dark:hover:text-army-300"
                }`}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden h-10 w-16 overflow-hidden rounded-lg border border-army-purple/20 bg-gradient-to-br from-army-200 to-army-400 sm:block"
            title="Arirang World Tour poster placeholder"
          >
            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-army-900">
              ARIRANG
            </div>
          </div>

          <button
            type="button"
            onClick={toggle}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-army-purple focus:ring-offset-2 dark:focus:ring-offset-neutral-900 ${
              dark ? "bg-army-purple" : "bg-army-purple/30"
            }`}
            aria-pressed={dark}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Light mode" : "Dark mode"}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                dark ? "left-6" : "left-1"
              }`}
            />
          </button>
          <NotificationBell />

          <div className="flex items-center gap-2">
            {supportEnabled && (
              <Link
                href="/support"
                className="hidden rounded-lg border border-army-purple/30 bg-army-purple/10 px-3 py-2 text-sm font-semibold text-army-purple hover:bg-army-purple/15 dark:border-army-purple/40 dark:bg-army-purple/20 dark:text-army-300 sm:inline-flex"
                aria-label="Support us"
              >
                Support us 💜
              </Link>
            )}
            {isLoggedIn && user ? (
              <>
                <div className="hidden max-w-[180px] truncate text-right sm:block">
                  <p className="truncate text-sm font-semibold text-army-purple dark:text-army-300" title={user.email || user.username}>
                    {user.email || user.username}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn-army-ghost rounded-lg px-3 py-2 text-sm"
                  aria-label="Sign out"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="btn-army rounded-lg px-3 py-2 text-sm"
                aria-label="Get started"
              >
                Get started
              </Link>
            )}
          </div>
        </div>
      </div>

      <nav className="border-t border-army-purple/10 px-4 py-2 md:hidden" aria-label="Mobile">
        <div className="flex items-center gap-2">
          {topMobileLinks.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            const showChatBadge = href === "/chats" && unreadChatsCount > 0;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-semibold ${
                  isActive ? "bg-army-purple/10 text-army-purple" : "text-neutral-600 hover:bg-army-purple/5"
                }`}
              >
                {label}
                {showChatBadge && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-army-purple px-1 text-[10px] font-bold text-white"
                    aria-label={`${unreadChatsCount} new discussion${unreadChatsCount !== 1 ? "s" : ""}`}
                  >
                    {unreadChatsCount > 99 ? "99+" : unreadChatsCount}
                  </span>
                )}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg border border-army-purple/20 bg-white px-3 py-2 text-sm font-semibold text-army-purple hover:bg-army-purple/5 dark:border-army-purple/30 dark:bg-neutral-900 dark:hover:bg-army-purple/10"
            aria-expanded={mobileMenuOpen}
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-army-purple/15 bg-white p-2 dark:border-army-purple/25 dark:bg-neutral-900">
            {overflowMobileLinks.map(({ href, label }) => {
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${
                    isActive
                      ? "bg-army-purple/10 text-army-purple"
                      : "text-neutral-700 hover:bg-army-purple/5 dark:text-neutral-300 dark:hover:bg-army-purple/10"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {mounted && mobileAnnouncementOpen && createPortal(
        <div
          className="fixed inset-0 z-[1000] bg-black/60 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-safety-title"
          onClick={closeMobileAnnouncement}
        >
          <div
            className="fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-army-purple/20 bg-white p-5 shadow-2xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeMobileAnnouncement}
              className="absolute right-3 top-3 rounded-lg px-2 py-1 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              aria-label="Close"
            >
              ✕
            </button>
            <h2 id="mobile-safety-title" className="font-display text-lg font-bold text-army-purple">
              Safety updates
            </h2>
            <div className="mt-3 max-h-[70vh] space-y-3 overflow-y-auto text-left">
              <div className="rounded-xl border border-army-purple/15 bg-army-purple/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-army-purple">Safety update</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  We’re temporarily taking down all available tickets while admins review them. Approved tickets will be re-listed soon.
                </p>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <span className="font-semibold">Sellers with pending tickets:</span> please submit your seller proof form — you’ll find it under <span className="font-semibold">My tickets</span>. We will temporarily keep the seller proof form only for pending tickets, but for all new tickets it’s merged into the Sell Ticket form.
                </p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">Scam alert</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  Admins will never ask for ticket transfer, order numbers, or payment info.
                </p>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <span className="font-semibold">Only admins:</span> Hajar (achatibihajar@gmail.com) and Tom (tomkoods2020@gmail.com). We haven't sent any emails to any of the users, and we are not sending anything now. Please don't reply to scammers.
                </p>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                  If someone claims they’re an admin, check for the blue verified <span className="font-semibold">Admin</span> badge. If there’s no badge (or the message feels suspicious), tap <span className="font-semibold">Report</span> inside the chat.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeMobileAnnouncement}
                className="btn-army rounded-lg px-4 py-2 text-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
