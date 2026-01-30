"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import { useTheme } from "@/lib/ThemeContext";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/tickets", label: "Tickets" },
  { href: "/chats", label: "Chats" },
  { href: "/disclaimers", label: "Disclaimers" },
  { href: "/user-manual", label: "User manual" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const { user, isLoggedIn, isAdmin, signOut } = useAuth();
  const { getUnreadChatsCount } = useChat();
  const unreadChatsCount = isLoggedIn && user ? getUnreadChatsCount(user.id) : 0;
  const showAdmin = isLoggedIn && isAdmin;
  const [mobileAnnouncementOpen, setMobileAnnouncementOpen] = useState(false);

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
                {" "}If you’re a seller, please check your Chats—admins will message you to review your ticket so we can re-list it. Reply within 24h or your listing will be removed (you can resubmit after).
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
              Admins will never ask for ticket transfer, order numbers, or payment info — we only ask for proof.
              <span className="hidden sm:inline">
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

      <nav className="flex gap-1 border-t border-army-purple/10 px-4 py-2 md:hidden" aria-label="Mobile">
        {NAV.map(({ href, label }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
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
        {showAdmin && (
          <Link
            href="/admin"
            className={`flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-semibold ${
              pathname === "/admin" || pathname.startsWith("/admin/")
                ? "bg-army-purple/10 text-army-purple"
                : "text-neutral-600 hover:bg-army-purple/5"
            }`}
          >
            Admin
          </Link>
        )}
      </nav>

      {mobileAnnouncementOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-safety-title"
          onClick={closeMobileAnnouncement}
        >
          <div
            className="relative w-full max-w-sm translate-y-6 rounded-2xl border border-army-purple/20 bg-white p-5 text-center shadow-2xl dark:bg-neutral-900"
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
            <div className="mt-3 space-y-3 text-left">
              <div className="rounded-xl border border-army-purple/15 bg-army-purple/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-army-purple">Safety update</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  We’re temporarily taking down all available tickets while admins review them. Approved tickets will be re-listed soon.
                </p>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <span className="font-semibold">Sellers:</span> please check your Chats—admins will message you to review your ticket so we can re-list it. Reply within 24h or your listing will be removed (you can resubmit after).
                </p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">Scam alert</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  Admins will never ask for ticket transfer, order numbers, or payment info — we only ask for proof.
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
        </div>
      )}
    </header>
  );
}
