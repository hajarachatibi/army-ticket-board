"use client";

import { useEffect, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

export default function TurnstileGateModal({
  open,
  onClose,
  onVerified,
  title,
  action,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: (token: string) => void;
  title: string;
  action: string;
}) {
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setToken("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="turnstile-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="turnstile-title" className="font-display text-xl font-bold text-army-purple">
          {title}
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Please verify to continue.
        </p>

        <div className="mt-4 flex justify-center">
          <TurnstileWidget onToken={(t) => setToken(t)} action={action} />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-army-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-army"
            disabled={!token}
            onClick={() => onVerified(token)}
            title={!token ? "Complete verification first" : "Continue"}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

