"use client";

import { useEffect } from "react";

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // This helps diagnose "stuck on Loading" issues in production.
    // eslint-disable-next-line no-console
    console.error("[ATB] /login error boundary:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-army-subtle px-4 text-center">
      <h1 className="font-display text-2xl font-bold text-army-purple">Login error</h1>
      <p className="max-w-xl text-sm text-neutral-700 dark:text-neutral-300">
        Something crashed while loading the login page. Please refresh. If it keeps happening, send us a screenshot of the error
        shown below.
      </p>
      <pre className="w-full max-w-2xl overflow-auto rounded-xl border border-army-purple/20 bg-white/70 p-3 text-left text-xs text-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-100">
        {String(error?.message || error)}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
      <div className="flex gap-2">
        <button type="button" className="btn-army" onClick={() => reset()}>
          Try again
        </button>
        <a className="btn-army-outline" href="/">
          Back home
        </a>
      </div>
    </main>
  );
}

