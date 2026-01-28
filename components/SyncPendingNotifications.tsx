"use client";

import { useEffect } from "react";

import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";
import { popPendingForUser } from "@/lib/notificationsStorage";

export default function SyncPendingNotifications() {
  const { user } = useAuth();
  const { add } = useNotifications();

  useEffect(() => {
    if (!user?.id) return;
    const pending = popPendingForUser(user.id);
    pending.forEach((p) => {
      if (
        p.type === "request_received" ||
        p.type === "request_accepted" ||
        p.type === "request_rejected" ||
        p.type === "ticket_reported" ||
        p.type === "new_message"
      )
        add({
          type: p.type,
          ticketId: p.ticketId,
          requestId: p.requestId,
          message: p.message,
          ticketSummary: p.ticketSummary,
        });
    });
  }, [user?.id, add]);

  return null;
}
