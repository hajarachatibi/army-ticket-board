"use client";

import { useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";
import { pushPendingForUser } from "@/lib/notificationsStorage";
import { insertReport } from "@/lib/supabase/reports";
import type { Ticket } from "@/lib/data/tickets";

export const REPORT_REASONS = [
  "Not face value",
  "Suspicious behaviour",
  "Scam / fake listing",
  "Harassment or abuse",
  "Other",
] as const;

type ReportModalProps = {
  open: boolean;
  onClose: () => void;
  ticket?: Pick<Ticket, "id" | "ownerId" | "event" | "city" | "day"> | null;
  onReported?: (ticketId: string) => void;
};

export default function ReportModal({
  open,
  onClose,
  ticket,
  onReported,
}: ReportModalProps) {
  const { user } = useAuth();
  const { add: addNotification } = useNotifications();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !ticket) return;
    setSubmitting(true);
    setError(null);

    try {
      const { error: dbError } = await insertReport({
        ticketId: ticket.id,
        reporterId: user?.id ?? null,
        reportedByUsername: user?.username ?? user?.email ?? null,
        reason,
        details: details.trim() || undefined,
      });
      if (dbError) {
        setError(dbError);
        setSubmitting(false);
        return;
      }

      const sellerMessage =
        "Hi, you have been reported for this ticket, the admins will check it, you will receive an email in case of any actions or justification needed.";
      if (ticket.ownerId && ticket.ownerId !== user?.id) {
        pushPendingForUser(ticket.ownerId, {
          type: "ticket_reported",
          ticketId: ticket.id,
          message: sellerMessage,
          ticketSummary: summary,
        });
      }
      addNotification({
        type: "ticket_reported",
        ticketId: ticket.id,
        message: "Your report has been submitted.",
        ticketSummary: summary,
      });
      onReported?.(ticket.id);
      setReason("");
      setDetails("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setDetails("");
    setError(null);
    onClose();
  };

  const summary = ticket
    ? [ticket.event, ticket.city, ticket.day].filter(Boolean).join(" · ")
    : "—";

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4 opacity-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={handleClose}
    >
      <div
        className="modal-panel w-full max-w-md cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-modal-title" className="font-display text-xl font-bold text-army-purple">
          Report ticket
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {summary}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="report-reason"
              className="block text-sm font-semibold text-army-purple"
            >
              Reason for report
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-army mt-1"
              required
            >
              <option value="">Select a reason</option>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="report-details"
              className="block text-sm font-semibold text-army-purple"
            >
              Additional details <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Any extra context..."
              rows={3}
              className="input-army mt-1 resize-none"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleClose} className="btn-army-outline">
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
