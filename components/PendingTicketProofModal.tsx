"use client";

import { useMemo, useState } from "react";

import { uploadTicketProofAttachment } from "@/lib/supabase/uploadTicketProofAttachment";
import type { Ticket } from "@/lib/data/tickets";

export default function PendingTicketProofModal({
  open,
  onClose,
  ticket,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  userId: string | null;
}) {
  const [proofTicketPage, setProofTicketPage] = useState<File | null>(null);
  const [proofScreenRecording, setProofScreenRecording] = useState<File | null>(null);
  const [proofEmailScreenshot, setProofEmailScreenshot] = useState<File | null>(null);
  const [priceNote, setPriceNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (!ticket) return "Seller proof form";
    return `Seller proof form — ${[ticket.event, ticket.city, ticket.day].filter(Boolean).join(" · ") || ticket.id}`;
  }, [ticket]);

  if (!open) return null;

  const canSubmit =
    !!ticket &&
    !!userId &&
    !submitting &&
    !!proofTicketPage &&
    !!proofScreenRecording &&
    !!proofEmailScreenshot;

  const submit = async () => {
    if (!ticket || !userId || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const groupId = ticket.id;

      const a = await uploadTicketProofAttachment({
        userId,
        groupId,
        kind: "tm_ticket_page",
        file: proofTicketPage!,
      });
      if ("error" in a) {
        setError(a.error);
        return;
      }

      const b = await uploadTicketProofAttachment({
        userId,
        groupId,
        kind: "tm_screen_recording",
        file: proofScreenRecording!,
      });
      if ("error" in b) {
        setError(b.error);
        return;
      }

      const c = await uploadTicketProofAttachment({
        userId,
        groupId,
        kind: "tm_email_screenshot",
        file: proofEmailScreenshot!,
      });
      if ("error" in c) {
        setError(c.error);
        return;
      }

      const res = await fetch("/api/tickets/proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          proofTmTicketPagePath: a.path,
          proofTmScreenRecordingPath: b.path,
          proofTmEmailScreenshotPath: c.path,
          proofPriceNote: priceNote.trim() ? priceNote.trim() : null,
        }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) {
        setError(j?.error || `HTTP ${res.status}`);
        return;
      }

      onClose();
      setProofTicketPage(null);
      setProofScreenRecording(null);
      setProofEmailScreenshot(null);
      setPriceNote("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit proofs");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Seller proof form"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-bold text-army-purple">{title}</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Required for pending tickets. Upload Ticketmaster proofs.
            </p>
          </div>
          <button type="button" className="btn-army-outline" onClick={onClose} disabled={submitting}>
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
            <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">
              1) Screenshot of TM ticket page (today’s date + your name handwritten)
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm"
              onChange={(e) => setProofTicketPage(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>

          <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
            <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">
              2) Screen recording scrolling TM app
            </p>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="mt-2 block w-full text-sm"
              onChange={(e) => setProofScreenRecording(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>

          <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
            <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">
              3) Screenshot of TM email (hide sensitive info) to prove face value
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm"
              onChange={(e) => setProofEmailScreenshot(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>

          <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
            <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">
              Optional note (if price is not face value, explain fees)
            </label>
            <textarea
              rows={3}
              className="input-army mt-2 resize-none"
              value={priceNote}
              onChange={(e) => setPriceNote(e.target.value)}
              placeholder="Optional…"
              disabled={submitting}
            />
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-army" onClick={submit} disabled={!canSubmit}>
            {submitting ? "Submitting…" : "Submit proofs"}
          </button>
        </div>
      </div>
    </div>
  );
}

