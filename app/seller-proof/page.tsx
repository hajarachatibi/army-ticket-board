import { Suspense } from "react";
import SellerProofPageContent from "@/app/seller-proof/SellerProofPageContent";

export const metadata = {
  title: "Seller Proof | ARMY Ticket Board",
};

export const dynamic = "force-dynamic";

export default function SellerProofPage() {
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
      <SellerProofPageContent />
    </Suspense>
  );
}

