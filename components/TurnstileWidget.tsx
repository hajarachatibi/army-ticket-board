"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    ensureScriptLoaded();
    let cancelled = false;
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
    if (!siteKey) return;

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
          // no-op; caller should fail closed
        },
        theme: "auto",
      });
    };

    const t = setInterval(tryRender, 200);
    tryRender();
    return () => {
      cancelled = true;
      clearInterval(t);
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

  return <div ref={ref} className={className} />;
}

