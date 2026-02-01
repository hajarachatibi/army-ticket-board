import { Suspense } from "react";

import LoginPageContent from "./LoginPageContent";

export const dynamic = "force-dynamic";

function LoginLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-army-subtle">
      <p className="text-army-purple">Loading…</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <>
      {/* Debug helper: if you only see "Loading…" forever, check DevTools Console for this log. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{document.documentElement.setAttribute('data-atb-inline','1');console.log('[ATB] /login inline script ran');}catch(e){}",
        }}
      />
      <Suspense fallback={<LoginLoading />}>
        <LoginPageContent />
      </Suspense>
    </>
  );
}
