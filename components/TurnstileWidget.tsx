"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

function ensureScriptLoaded(): void {
  if (typeof document === "undefined") return;
  const id = "cf-turnstile-script";
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

export default function TurnstileWidget({
  onToken,
  action,
  className,
}: {
  onToken: (token: string) => void;
  /** Optional Turnstile action label */
  action?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    ensureScriptLoaded();
    let cancelled = false;
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
    if (!siteKey) {
      setHint("Verification is not configured (missing NEXT_PUBLIC_TURNSTILE_SITE_KEY).");
      return;
    }

    setHint("Loading verification…");

    const tryRender = () => {
      if (cancelled) return;
      if (!ref.current) return;
      if (!window.turnstile) return;
      if (widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        action,
        callback: (token: string) => onToken(token),
        "expired-callback": () => {
          // user needs to complete again; no-op (caller will require token)
        },
        "error-callback": () => {
          setHint("Verification failed to load. If you use an ad blocker, allow challenges.cloudflare.com and try again.");
        },
        theme: "auto",
      });
      setHint(null);
    };

    const t = setInterval(tryRender, 200);
    tryRender();

    const warn = setTimeout(() => {
      if (cancelled) return;
      if (!widgetIdRef.current) {
        setHint("Still loading… If this stays blank, allow challenges.cloudflare.com (ad blockers can block it).");
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(t);
      clearTimeout(warn);
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id && window.turnstile?.remove) {
        try {
          window.turnstile.remove(id);
        } catch {
          /* ignore */
        }
      }
    };
  }, [action, onToken]);

  return (
    <div className={className}>
      <div ref={ref} />
      {hint && (
        <p className="mt-3 text-center text-xs text-neutral-600 dark:text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
}

