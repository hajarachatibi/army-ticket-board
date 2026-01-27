"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import { useNotifications } from "@/lib/NotificationContext";
import { pushPendingForUser } from "@/lib/notificationsStorage";
import { useRequest } from "@/lib/RequestContext";
import type { Ticket } from "@/lib/data/tickets";

type RequestModalProps = {
  open: boolean;
  onClose: () => void;
  ticket?: Ticket | null;
};

function formatSeat(t: Ticket): string {
  const parts: string[] = [];
  if (t.section) parts.push(`Section ${t.section}`);
  if (t.row) parts.push(`Row ${t.row}`);
  if (t.seat) parts.push(`Seat ${t.seat}`);
  return parts.length ? parts.join(", ") : "—";
}

export default function RequestModal({
  open,
  onClose,
  ticket,
}: RequestModalProps) {
  const { user } = useAuth();
  const { add: addNotification } = useNotifications();
  const {
    addRequest,
    fetchRequestsForTicket,
    getRequestsForTicket,
    updateStatus,
    closeRequest,
  } = useRequest();
  const {
    createChat,
    getOpenChatsForTicket,
    closeChat,
    openChatModal,
  } = useChat();
  const [name, setName] = useState("");
  const [seatPref, setSeatPref] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ticketId = ticket?.id;
  const ownerId = ticket?.ownerId ?? null;
  const requests = open && ticketId ? getRequestsForTicket(ticketId) : [];
  const isSeller = !!user && !!ownerId && ownerId === user.id;
  const eventLabel = ticket?.event ?? "—";
  const defaultSeat = ticket ? formatSeat(ticket) : "";

  useEffect(() => {
    if (open && ticket) {
      setSeatPref(formatSeat(ticket));
      fetchRequestsForTicket(ticket.id);
    }
  }, [open, ticket, fetchRequestsForTicket]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !ticketId || !ticket) return;
    setSubmitting(true);
    const seatPreference = [seatPref.trim(), note.trim()].filter(Boolean).join(" — ") || defaultSeat;
    const req = await addRequest(
      ticketId,
      user.id,
      name.trim() || user.username,
      eventLabel,
      seatPreference
    );
    if (req && ownerId && ownerId !== user.id) {
      const msg = `${name || user.username} requested: ${eventLabel} — ${seatPreference}.`;
      pushPendingForUser(ownerId, {
        type: "request_received",
        ticketId,
        message: msg,
      });
    }
    setName("");
    setSeatPref(defaultSeat);
    setNote("");
    setSubmitting(false);
    if (req) onClose();
  };

  const handleAccept = async (
    requestId: string,
    requesterId: string,
    requesterUsername: string
  ) => {
    if (!user || !ticketId || !ownerId || !ticket) return;
    setSubmitting(true);
    const otherOpen = getOpenChatsForTicket(ticketId);
    for (const c of otherOpen) {
      await closeChat(c.id);
      await closeRequest(c.requestId, c.ticketId);
    }
    await updateStatus(requestId, "accepted", user.id);
    const ticketSummary = [ticket.event, ticket.city, ticket.day].filter(Boolean).join(" · ") || ticketId;
    const chat = await createChat({
      requestId,
      ticketId,
      buyerId: requesterId,
      sellerId: ownerId,
      buyerUsername: requesterUsername,
      sellerUsername: user.username,
      ticketSummary,
    });
    addNotification({
      type: "request_accepted",
      ticketId,
      requestId,
      message: `Request accepted for ticket ${ticketId}. You can now chat.`,
    });
    pushPendingForUser(requesterId, {
      type: "request_accepted",
      ticketId,
      requestId,
      message: `Your request for ticket ${ticketId} was accepted. You can now chat.`,
    });
    setSubmitting(false);
    onClose();
    if (chat) openChatModal(chat.id);
  };

  const handleRefuse = async (requestId: string, requesterId: string) => {
    setSubmitting(true);
    await updateStatus(requestId, "rejected");
    addNotification({
      type: "request_rejected",
      ticketId,
      requestId,
      message: `Request declined for ticket ${ticketId ?? "—"}`,
    });
    pushPendingForUser(requesterId, {
      type: "request_rejected",
      ticketId,
      requestId,
      message: `Your request for ticket ${ticketId ?? "—"} was declined.`,
    });
    setSubmitting(false);
  };

  const handleClose = () => {
    setName("");
    setSeatPref(defaultSeat);
    setNote("");
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
      aria-labelledby="request-modal-title"
      onClick={handleClose}
    >
      <div
        className="modal-panel flex max-h-[85vh] w-full max-w-lg cursor-default flex-col overflow-hidden rounded-2xl border border-army-purple/20 bg-white shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-army-purple/15 p-4 dark:border-army-purple/25">
          <h2 id="request-modal-title" className="font-display text-xl font-bold text-army-purple">
            Request this ticket
          </h2>
          <p className="mt-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {summary}
          </p>
          {ticket && (
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              Section {ticket.section}, Row {ticket.row}, Seat {ticket.seat}
              {ticket.vip && " · VIP"}
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-army-purple">Requests for this ticket</h3>
          {requests.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">No requests yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-army-purple/15 bg-army-purple/5 px-3 py-2 dark:border-army-purple/25 dark:bg-army-purple/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-army-purple">{r.requesterUsername}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        {r.event ?? "—"} — {r.seatPreference ?? "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-500">
                        {r.status === "pending"
                          ? "Pending"
                          : r.status === "accepted"
                            ? "Accepted — chat enabled"
                            : r.status === "closed"
                              ? "Closed"
                              : "Declined"}
                      </p>
                    </div>
                    {isSeller && r.status === "pending" && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleRefuse(r.id, r.requesterId)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
                        >
                          Refuse
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleAccept(r.id, r.requesterId, r.requesterUsername)}
                          className="btn-army rounded-lg px-2 py-1 text-xs disabled:opacity-50"
                        >
                          Accept
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!isSeller && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-army-purple">New request</h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                This request will go directly to the seller for this ticket.
              </p>
              <form onSubmit={handleSubmit} className="mt-2 space-y-3">
            <div>
              <label htmlFor="request-name" className="block text-sm font-semibold text-army-purple">
                Your name
              </label>
              <input
                id="request-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={user?.username ?? "Your name"}
                className="input-army mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-army-purple">
                Event
              </label>
              <p className="mt-1 rounded-lg border border-army-purple/20 bg-army-purple/5 px-3 py-2 text-sm text-neutral-700 dark:bg-army-purple/10 dark:text-neutral-300">
                {eventLabel}
              </p>
            </div>
            <div>
              <label htmlFor="request-seat" className="block text-sm font-semibold text-army-purple">
                Seat preference
              </label>
              <input
                id="request-seat"
                type="text"
                value={seatPref}
                onChange={(e) => setSeatPref(e.target.value)}
                placeholder="e.g. Section A, Row 12, Seat 1-2"
                className="input-army mt-1"
              />
            </div>
            <div>
              <label htmlFor="request-note" className="block text-sm font-semibold text-army-purple">
                Note to seller <span className="font-normal text-neutral-500">(optional)</span>
              </label>
              <textarea
                id="request-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any message for the seller..."
                rows={2}
                className="input-army mt-1 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={handleClose} className="btn-army-outline">
                Cancel
              </button>
              <button type="submit" className="btn-army" disabled={submitting}>
                {submitting ? "…" : "Submit request"}
              </button>
            </div>
          </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
