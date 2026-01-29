"use client";

import { useEffect } from "react";

import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";
import { supabase } from "@/lib/supabaseClient";

type DbNotificationRow = {
  id: string;
  type: string;
  ticket_id: string | null;
  ticket_summary: string | null;
  message: string | null;
  delivered: boolean;
  created_at: string;
};

export default function SyncDbNotifications() {
  const { user } = useAuth();
  const { add } = useNotifications();

  useEffect(() => {
    const uid = user?.id ?? null;
    if (!uid) return;

    let cancelled = false;

    async function fetchUndelivered() {
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", uid)
        .eq("delivered", false)
        .order("created_at", { ascending: true })
        .limit(50);
      if (cancelled) return;
      if (error) return;
      const rows = (data ?? []) as DbNotificationRow[];
      if (rows.length === 0) return;

      rows.forEach((r) => {
        if (r.type === "ticket_approved" || r.type === "ticket_rejected") {
          add({
            type: r.type as "ticket_approved" | "ticket_rejected",
            ticketId: r.ticket_id ?? undefined,
            message: r.message ?? undefined,
            ticketSummary: r.ticket_summary ?? undefined,
          });
        }
      });

      // Mark as delivered so we don't re-add on refresh.
      void supabase.from("user_notifications").update({ delivered: true }).in(
        "id",
        rows.map((r) => r.id)
      );
    }

    fetchUndelivered();

    const channel = supabase
      .channel(`user_notifications_${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${uid}` },
        (payload) => {
          const r = payload.new as DbNotificationRow;
          if (r.type !== "ticket_approved" && r.type !== "ticket_rejected") return;
          add({
            type: r.type as "ticket_approved" | "ticket_rejected",
            ticketId: r.ticket_id ?? undefined,
            message: r.message ?? undefined,
            ticketSummary: r.ticket_summary ?? undefined,
          });
          void supabase.from("user_notifications").update({ delivered: true }).eq("id", r.id);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user?.id, add]);

  return null;
}

