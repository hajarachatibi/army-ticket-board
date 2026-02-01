"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useNotifications } from "@/lib/NotificationContext";
import type { Notification, NotificationType } from "@/lib/NotificationContext";

function label(type: NotificationType): string {
  switch (type) {
    case "request_accepted":
      return "Request accepted";
    case "request_rejected":
      return "Request rejected";
    case "request_received":
      return "New ticket request";
    case "connection_request_received":
      return "New connection request";
    case "connection_request_accepted":
      return "Connection accepted";
    case "connection_request_declined":
      return "Connection declined";
    case "connection_bonding_submitted":
      return "Bonding answers submitted";
    case "connection_preview_ready":
      return "Preview ready";
    case "connection_comfort_updated":
      return "Comfort answer updated";
    case "connection_social_updated":
      return "Social sharing updated";
    case "connection_agreement_updated":
      return "Match confirmation";
    case "connection_match_confirmed":
      return "Match confirmed";
    case "connection_ended":
      return "Connection ended";
    case "connection_expired":
      return "Connection expired";
    case "ticket_approved":
      return "Ticket approved";
    case "ticket_rejected":
      return "Ticket rejected";
    case "chat_opened":
      return "Chatroom opened";
    case "new_message":
      return "New chat message";
    case "ticket_reported":
      return "Ticket reported";
    default:
      return "Notification";
  }
}

function notificationHref(n: Notification): string {
  if (n.connectionId) return `/connections/${encodeURIComponent(n.connectionId)}`;
  const ticket = n.ticketId;
  if (!ticket) return "/tickets";
  switch (n.type) {
    case "request_received":
      return `/tickets?view=my&ticket=${ticket}`;
    case "ticket_approved":
    case "ticket_rejected":
      return `/tickets?view=my&ticket=${ticket}`;
    case "chat_opened":
    case "new_message":
    case "request_accepted":
      return `/chats?ticket=${ticket}`;
    default:
      return `/tickets?ticket=${ticket}`;
  }
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [reportPopup, setReportPopup] = useState<Notification | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleReportClick = (n: Notification) => {
    markRead(n.id);
    setOpen(false);
    setReportPopup(n);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-army-purple/10 hover:text-army-purple dark:text-neutral-400 dark:hover:text-army-300"
        aria-label={unreadCount ? `${unreadCount} unread` : "Notifications"}
      >
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-army-purple px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-army-purple/20 bg-white shadow-xl dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-army-purple/15 px-3 py-2 dark:border-army-purple/25">
              <span className="text-sm font-bold text-army-purple">Notifications</span>
              {notifications.length > 0 && (
                <button type="button" onClick={markAllRead} className="btn-army-ghost text-xs">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  No notifications yet
                </p>
              ) : (
                <ul>
                  {notifications.map((n) =>
                    n.type === "ticket_reported" ? (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleReportClick(n)}
                          className={`block w-full border-b border-army-purple/10 px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-army-purple/5 dark:border-army-purple/15 ${
                            !n.read ? "bg-army-purple/5 dark:bg-army-purple/10" : ""
                          }`}
                        >
                          <p className="font-semibold text-army-purple">{label(n.type)}</p>
                          {n.message && (
                            <p className="mt-0.5 truncate text-neutral-600 dark:text-neutral-400">
                              {n.message}
                            </p>
                          )}
                          {(n.listingSummary || n.ticketSummary || n.ticketId) && (
                            <p className="mt-1 text-xs text-neutral-500">
                              {n.listingSummary ?? n.ticketSummary ?? `Ticket ${n.ticketId}`}
                            </p>
                          )}
                        </button>
                      </li>
                    ) : (
                      <li key={n.id}>
                        <Link
                          href={notificationHref(n)}
                          onClick={() => {
                            markRead(n.id);
                            setOpen(false);
                          }}
                          className={`block border-b border-army-purple/10 px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-army-purple/5 dark:border-army-purple/15 ${
                            !n.read ? "bg-army-purple/5 dark:bg-army-purple/10" : ""
                          }`}
                        >
                          <p className="font-semibold text-army-purple">{label(n.type)}</p>
                          {n.message && (
                            <p className="mt-0.5 truncate text-neutral-600 dark:text-neutral-400">
                              {n.message}
                            </p>
                          )}
                          {(n.listingSummary || n.ticketSummary || n.ticketId) && (
                            <p className="mt-1 text-xs text-neutral-500">
                              {n.listingSummary ?? n.ticketSummary ?? `Ticket ${n.ticketId}`}
                            </p>
                          )}
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {reportPopup &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-backdrop fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-notification-title"
            onClick={() => setReportPopup(null)}
          >
            <div
              className="modal-panel max-h-[90vh] w-full max-w-md cursor-default overflow-y-auto rounded-2xl border border-army-purple/20 bg-white p-5 shadow-xl dark:bg-neutral-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="report-notification-title" className="font-display text-lg font-bold text-army-purple">
                {label(reportPopup.type)}
              </h2>
              {(reportPopup.ticketSummary || reportPopup.ticketId) && (
                <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Ticket: {reportPopup.ticketSummary ?? reportPopup.ticketId}
                </p>
              )}
              {reportPopup.message && (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-700 dark:text-neutral-300">
                  {reportPopup.message}
                </p>
              )}
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setReportPopup(null)}
                  className="btn-army-outline rounded-lg px-4 py-2 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
