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
    <Suspense fallback={<LoginLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}
