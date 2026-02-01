"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { useChat } from "@/lib/ChatContext";
import { useNotifications } from "@/lib/NotificationContext";
import { useRequest, type Request } from "@/lib/RequestContext";
import { pushPendingForUser } from "@/lib/notificationsStorage";
import { displayName } from "@/lib/displayName";
import type { Ticket } from "@/lib/data/tickets";
import { fetchProfile } from "@/lib/data/user_profiles";

export default function TicketRequestsModal({
  open,
  onClose,
  ticket,
}: {
  open: boolean;
  onClose: () => void;
  ticket: Pick<Ticket, "id" | "event" | "city" | "day" | "ownerId"> | null;
}) {
  const { user, isAdmin } = useAuth();
  const { createChat, openChatModal, getOpenChatsForTicket } = useChat();
  const { add: addNotification } = useNotifications();
  const { fetchRequestsForTicket, getRequestsForTicket, updateStatus } = useRequest();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = ticket ? [ticket.event, ticket.city, ticket.day].filter(Boolean).join(" · ") || ticket.id : "—";

  useEffect(() => {
    if (!open || !ticket?.id) return;
    setError(null);
    setLoading(true);
    fetchRequestsForTicket(ticket.id).finally(() => setLoading(false));
  }, [open, ticket?.id, fetchRequestsForTicket]);

  const requests = useMemo(() => {
    if (!ticket?.id) return [];
    return getRequestsForTicket(ticket.id);
  }, [ticket?.id, getRequestsForTicket]);

  const pending = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);

  if (!open || !ticket) return null;

  const canManage = !!user && !!ticket.ownerId && user.id === ticket.ownerId;

  const accept = async (r: Request) => {
    if (!user || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      // Accept selected request
      await updateStatus(r.id, "accepted", user.id, ticket.id);
      // Reject other pending requests (best-effort)
      for (const other of pending) {
        if (other.id === r.id) continue;
        await updateStatus(other.id, "rejected", undefined, ticket.id);
      }

      const { data: sellerProfile } = await fetchProfile(user.id);
      const sellerUsername = sellerProfile?.username ?? user.username ?? "Seller";
      const chat = await createChat({
        requestId: r.id,
        ticketId: ticket.id,
        buyerId: r.requesterId,
        sellerId: user.id,
        buyerUsername: r.requesterUsername,
        sellerUsername,
        ticketSummary: summary,
      });

      // Notify buyer
      pushPendingForUser(r.requesterId, {
        type: "request_accepted",
        ticketId: ticket.id,
        requestId: r.id,
        message: `Your request was accepted. You can chat now: ${summary}`,
        ticketSummary: summary,
      });
      addNotification({
        type: "request_accepted",
        ticketId: ticket.id,
        requestId: r.id,
        message: "Request accepted. Chat opened.",
        ticketSummary: summary,
      });

      // Refresh list + open chat for seller
      await fetchRequestsForTicket(ticket.id);
      if (chat) openChatModal(chat.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept request");
    } finally {
      setLoading(false);
    }
  };

  const reject = async (r: Request) => {
    if (!user || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      await updateStatus(r.id, "rejected", undefined, ticket.id);
      pushPendingForUser(r.requesterId, {
        type: "request_rejected",
        ticketId: ticket.id,
        requestId: r.id,
        message: `Your request was rejected: ${summary}`,
        ticketSummary: summary,
      });
      addNotification({
        type: "request_rejected",
        ticketId: ticket.id,
        requestId: r.id,
        message: "Request rejected.",
        ticketSummary: summary,
      });
      await fetchRequestsForTicket(ticket.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject request");
    } finally {
      setLoading(false);
    }
  };

  const close = () => onClose();

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-requests-title"
      onClick={close}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="ticket-requests-title" className="font-display text-xl font-bold text-army-purple">
              Ticket requests
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{summary}</p>
            {getOpenChatsForTicket(ticket.id).length > 0 && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                You already have {getOpenChatsForTicket(ticket.id).length} chat(s) for this ticket.
              </p>
            )}
          </div>
          <button type="button" className="btn-army-outline" onClick={close}>
            Close
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5">
          {loading ? (
            <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="rounded-xl border border-army-purple/15 bg-white/80 px-4 py-6 text-center text-sm text-neutral-600 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-400">
              No requests yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-army-purple/15 bg-white/80 shadow-sm dark:border-army-purple/25 dark:bg-neutral-900/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                      <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">User</th>
                      <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Status</th>
                      <th className="px-4 py-3 font-semibold text-army-purple dark:text-army-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-army-purple/10 last:border-0 hover:bg-army-purple/5 dark:border-army-purple/20 dark:hover:bg-army-purple/10"
                      >
                        <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                          {displayName(r.requesterUsername, { viewerIsAdmin: isAdmin, subjectIsAdmin: false })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {!canManage || r.status !== "pending" ? (
                            <span className="text-xs text-neutral-500">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => accept(r)}
                                disabled={loading}
                                className="rounded bg-army-purple px-2 py-1 text-xs font-semibold text-white hover:bg-army-700 disabled:opacity-50"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => reject(r)}
                                disabled={loading}
                                className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

