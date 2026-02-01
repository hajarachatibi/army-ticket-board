import { Suspense } from "react";
import OnboardingPageContent from "@/app/onboarding/OnboardingPageContent";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-army-purple">Loading…</p>
          </div>
        </main>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}

