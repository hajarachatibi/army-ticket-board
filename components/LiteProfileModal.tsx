"use client";

import { useEffect, useMemo, useState } from "react";

import VerifiedAdminBadge from "@/components/VerifiedAdminBadge";
import { fetchLiteProfile, type LiteProfile } from "@/lib/supabase/liteProfile";

export default function LiteProfileModal({
  open,
  onClose,
  userId,
  title,
  showSellerApprovedCount,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  title?: string;
  /** Only show when viewer is buyer looking at seller. */
  showSellerApprovedCount?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<LiteProfile | null>(null);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: e } = await fetchLiteProfile(userId);
      if (cancelled) return;
      setLoading(false);
      if (e) setError(e);
      else setProfile(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const answers = useMemo(() => {
    const list = profile?.forumAnswers ?? [];
    return list.filter((a) => a.prompt.trim().length > 0);
  }, [profile?.forumAnswers]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lite-profile-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm cursor-default rounded-2xl border border-army-purple/20 bg-white p-4 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="lite-profile-title" className="font-display text-xl font-bold text-army-purple">
              {title ?? "Profile"}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Lite profile: username, admin badge, and ARMY check answers.
            </p>
          </div>
          <button type="button" className="btn-army-outline" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
          {loading ? (
            <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : !profile ? (
            <p className="text-neutral-500 dark:text-neutral-400">No profile found.</p>
          ) : (
            <>
              <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Username</p>
                    <p className="mt-1 flex items-center gap-2 truncate font-semibold text-neutral-800 dark:text-neutral-200">
                      <span className="truncate">{profile.username}</span>
                      {profile.isAdmin && <VerifiedAdminBadge />}
                    </p>
                    {!!profile.email && (
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{profile.email}</p>
                    )}
                  </div>

                  {showSellerApprovedCount && (
                    <div className="rounded-xl border border-army-purple/15 bg-army-purple/5 px-4 py-3 text-center dark:border-army-purple/25 dark:bg-army-purple/10">
                      <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Seller approvals</p>
                      <p className="mt-1 text-2xl font-bold text-army-purple">{profile.sellerApprovedCount}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <h3 className="font-display text-lg font-bold text-army-purple">ARMY check answers</h3>
                {answers.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">No answers found.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {answers.map((a, idx) => (
                      <div
                        key={a.id}
                        className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">
                          Question {idx + 1}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-army-purple">{a.prompt}</p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          Answer
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-700 dark:text-neutral-300">
                          {a.answer?.trim() ? a.answer : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

