"use client";

import { Suspense } from "react";

import ChatsPageContent from "./ChatsPageContent";

function ChatsLoading() {
  return (
    <main className="min-h-screen bg-gradient-army-subtle">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-army-purple">
          Admin chats
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Admin-only: message users when needed.
        </p>
        <p className="mt-8 text-center text-neutral-500 dark:text-neutral-400">
          Loading…
        </p>
      </div>
    </main>
  );
}

export default function ChatsPage() {
  return (
    <Suspense fallback={<ChatsLoading />}>
      <ChatsPageContent />
    </Suspense>
  );
}
