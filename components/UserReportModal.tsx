"use client";

import { useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";
import { insertUserReport } from "@/lib/supabase/userReports";

export const USER_REPORT_REASONS = [
  "Pretending to be admin",
  "Scam attempt",
  "Harassment or abuse",
  "Suspicious behaviour",
  "Other",
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  reportedUserId: string | null;
  reportedLabel?: string | null;
  onReported?: () => void;
};

export default function UserReportModal({ open, onClose, reportedUserId, reportedLabel, onReported }: Props) {
  const { user } = useAuth();
  const { add: addNotification } = useNotifications();
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
    if (!reportedUserId || !reason) return;
    setSubmitting(true);
    setError(null);

    const { error: dbError } = await insertUserReport({
      reportedUserId,
      reporterId: user?.id ?? null,
      reportedByUsername: user?.username ?? user?.email ?? null,
      reason,
      details: details.trim() || undefined,
    });

    setSubmitting(false);
    if (dbError) {
      setError(dbError);
      return;
    }

    addNotification({
      type: "ticket_reported",
      ticketId: "user_report",
      message: "Thanks — your report has been submitted.",
      ticketSummary: reportedLabel ? `User: ${reportedLabel}` : "User report",
    });
    onReported?.();
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-report-modal-title"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="user-report-modal-title" className="font-display text-xl font-bold text-army-purple">
          Report user
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {reportedLabel ? `Reporting: ${reportedLabel}` : "Report suspicious behavior in chats."}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-army-purple" htmlFor="user-report-reason">
              Reason
            </label>
            <select
              id="user-report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-army mt-1"
              required
            >
              <option value="">Select a reason</option>
              {USER_REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-army-purple" htmlFor="user-report-details">
              Details <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <textarea
              id="user-report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="input-army mt-1 resize-none"
              placeholder="What did they say/do?"
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
            <button type="submit" className="btn-army" disabled={submitting || !reportedUserId}>
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

