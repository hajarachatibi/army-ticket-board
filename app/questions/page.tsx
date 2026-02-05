import { Suspense } from "react";
import QuestionsPageContent from "@/app/questions/QuestionsPageContent";

export const metadata = {
  title: "Questions | ARMY Ticket Board",
};

export const dynamic = "force-dynamic";

export default function QuestionsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-army-purple">Loading…</p>
          </div>
        </main>
      }
    >
      <QuestionsPageContent />
    </Suspense>
  );
}
