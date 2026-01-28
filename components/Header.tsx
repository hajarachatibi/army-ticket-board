"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  const { user, isLoggedIn, signOut } = useAuth();
  const { getUnreadChatsCount } = useChat();
  const unreadChatsCount = isLoggedIn && user ? getUnreadChatsCount(user.id) : 0;

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-army-purple/10 bg-white/95 shadow-header backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-army-purple/20 dark:bg-[#0f0f0f]/95 dark:supports-[backdrop-filter]:bg-[#0f0f0f]/80">
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
      </nav>
    </header>
  );
}
