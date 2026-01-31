"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { fetchMySellerProofStatus, submitSellerProof } from "@/lib/supabase/sellerProof";
import { uploadSellerProofImage } from "@/lib/supabase/uploadSellerProofImage";

export default function SellerProofPageContent() {
  const { user, isLoading, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<null | { hasApproved: boolean; latestStatus: string | null }>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [platform, setPlatform] = useState("");
  const [proofDetails, setProofDetails] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await fetchMySellerProofStatus();
    setLoading(false);
    if (e) setError(e);
    setStatus({ hasApproved: data.hasApproved, latestStatus: data.latestStatus });
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const canSubmit = useMemo(() => {
    return (
      !!user &&
      fullName.trim().length > 2 &&
      country.trim().length > 1 &&
      platform.trim().length > 1 &&
      proofDetails.trim().length > 10 &&
      !!screenshot
    );
  }, [user, fullName, country, platform, proofDetails, screenshot]);

  const submit = async () => {
    if (!user || !canSubmit || !screenshot) return;
    setSubmitting(true);
    setError(null);
    setOk(null);
    const up = await uploadSellerProofImage({ userId: user.id, file: screenshot });
    if ("error" in up) {
      setSubmitting(false);
      setError(up.error);
      return;
    }
    const { error: e } = await submitSellerProof({
      userId: user.id,
      fullName: fullName.trim(),
      country: country.trim(),
      platform: platform.trim(),
      proofDetails: proofDetails.trim(),
      screenshotUrl: up.path,
    });
    setSubmitting(false);
    if (e) {
      setError(e);
      return;
    }
    setOk("Submitted! Admins will review your seller proof soon.");
    setFullName("");
    setCountry("");
    setPlatform("");
    setProofDetails("");
    setScreenshot(null);
    void load();
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-army-purple">Loading…</p>
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-gradient-army-subtle px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-2xl font-bold text-army-purple">Seller proof</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Please sign in to continue.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/login" className="btn-army">
              Sign in
            </Link>
            <Link href="/tickets" className="btn-army-outline">
              Back
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-army-subtle px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold text-army-purple">Seller proof forum</h1>
          <Link href="/tickets" className="btn-army-outline">
            Back to Tickets
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-army-purple/15 bg-white/80 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-300">
          <p className="font-semibold text-army-purple">Why this is required</p>
          <p className="mt-1">
            To improve security, sellers must submit proof before admins approve new ticket listings. All fields are required.
          </p>
          {status && (
            <p className="mt-2">
              Current status:{" "}
              <span className="font-semibold">
                {status.hasApproved ? "approved" : status.latestStatus ? status.latestStatus : "not submitted"}
              </span>
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-xl border border-army-purple/20 bg-army-purple/5 px-4 py-3 text-sm text-army-purple dark:border-army-purple/30 dark:bg-army-purple/10">
            {ok}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-army-purple/15 bg-white p-5 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900">
          {loading ? (
            <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Full name</label>
                  <input className="input-army mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Country</label>
                  <input className="input-army mt-1" value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-semibold text-army-purple">Platform used (e.g. Ticketmaster)</label>
                <input className="input-army mt-1" value={platform} onChange={(e) => setPlatform(e.target.value)} />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-semibold text-army-purple">Proof details</label>
                <textarea
                  className="input-army mt-1 resize-none"
                  rows={4}
                  value={proofDetails}
                  onChange={(e) => setProofDetails(e.target.value)}
                  placeholder="Explain what the screenshot shows and why it proves you are the ticket owner…"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-semibold text-army-purple">Screenshot proof</label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-army-purple file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-army-700 dark:text-neutral-300"
                  onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                />
                {screenshot && (
                  <button type="button" className="mt-2 btn-army-outline" onClick={() => setScreenshot(null)}>
                    Remove screenshot
                  </button>
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button type="button" className="btn-army" disabled={!canSubmit || submitting} onClick={submit}>
                  {submitting ? "Submitting…" : "Submit for review"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

