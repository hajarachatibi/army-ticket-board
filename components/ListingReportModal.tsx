"use client";

import { useState } from "react";

export const LISTING_REPORT_REASONS = [
  "Not face value",
  "Suspicious behaviour",
  "Scam / fake listing",
  "Harassment or abuse",
  "Other",
] as const;

export default function ListingReportModal({
  open,
  onClose,
  listing,
  onReported,
}: {
  open: boolean;
  onClose: () => void;
  listing?: { listingId: string; summary: string } | null;
  onReported?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleClose = () => {
    setReason("");
    setDetails("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing || !reason) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.listingId,
          reason,
          details: details.trim() || null,
        }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) {
        setError(j?.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      onReported?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-report-title"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="listing-report-title" className="font-display text-xl font-bold text-army-purple">
          Report listing
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{listing?.summary ?? "—"}</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-army-purple">Reason for report</label>
            <select className="input-army mt-1" value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="">Select a reason</option>
              {LISTING_REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">
              Additional details <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <textarea
              className="input-army mt-1 resize-none"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Any extra context..."
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleClose} className="btn-army-outline" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-army" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

