"use client";

import { useEffect } from "react";

import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/lib/NotificationContext";
import type { NotificationType } from "@/lib/NotificationContext";
import { supabase } from "@/lib/supabaseClient";

const SUPPORTED_TYPES = [
  "ticket_approved",
  "ticket_rejected",
  "connection_request_received",
  "connection_request_accepted",
  "connection_request_declined",
  "connection_bonding_submitted",
  "connection_preview_ready",
  "connection_comfort_updated",
  "connection_social_updated",
  "connection_agreement_updated",
  "connection_match_confirmed",
  "connection_ended",
  "connection_expired",
  "listing_removed_3_reports",
  "story_published",
  "story_admin_replied",
] as const satisfies readonly NotificationType[];

type SupportedType = (typeof SUPPORTED_TYPES)[number];
const SUPPORTED_SET = new Set<string>(SUPPORTED_TYPES as readonly string[]);

type DbNotificationRow = {
  id: string;
  type: string;
  ticket_id: string | null;
  ticket_summary: string | null;
  listing_id?: string | null;
  listing_summary?: string | null;
  connection_id?: string | null;
  story_id?: string | null;
  message: string | null;
  report_reasons?: string | null;
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

    const deliveredKey = `army_delivered_db_notifications_${uid}`;
    const getDeliveredSet = (): Set<string> => {
      if (typeof window === "undefined") return new Set();
      try {
        const raw = window.localStorage.getItem(deliveredKey);
        const arr = raw ? (JSON.parse(raw) as string[]) : [];
        return new Set(arr.filter((x) => typeof x === "string" && x.length > 0));
      } catch {
        return new Set();
      }
    };
    const persistDeliveredSet = (set: Set<string>) => {
      if (typeof window === "undefined") return;
      try {
        // Cap size so it can't grow forever.
        const arr = Array.from(set).slice(-500);
        window.localStorage.setItem(deliveredKey, JSON.stringify(arr));
      } catch {
        /* ignore */
      }
    };
    const markDelivered = async (ids: string[]) => {
      if (ids.length === 0) return;
      // Best-effort: if this fails, localStorage prevents re-pop on refresh.
      await supabase
        .from("user_notifications")
        .update({ delivered: true })
        .eq("user_id", uid)
        .in("id", ids);
    };

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

      const deliveredSet = getDeliveredSet();
      const toShow = rows.filter((r) => !deliveredSet.has(r.id));
      if (toShow.length === 0) return;

      toShow.forEach((r) => {
        if (!SUPPORTED_SET.has(r.type)) return;
        add({
          // These rows are server-created with a strict CHECK constraint (see migrations),
          // but we still keep the client defensive by treating unknown types as a no-op.
          type: r.type as SupportedType,
          ticketId: r.ticket_id ?? undefined,
          ticketSummary: r.ticket_summary ?? undefined,
          listingId: r.listing_id ?? undefined,
          listingSummary: r.listing_summary ?? undefined,
          connectionId: r.connection_id ?? undefined,
          storyId: r.story_id ?? undefined,
          message: r.message ?? undefined,
          reportReasons: r.report_reasons ?? undefined,
        });
        deliveredSet.add(r.id);
      });

      persistDeliveredSet(deliveredSet);
      await markDelivered(toShow.map((r) => r.id));
    }

    fetchUndelivered();

    const channel = supabase
      .channel(`user_notifications_${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${uid}` },
        (payload) => {
          const r = payload.new as DbNotificationRow;
          if (!SUPPORTED_SET.has(r.type)) return;
          const deliveredSet = getDeliveredSet();
          if (deliveredSet.has(r.id)) return;
          add({
            type: r.type as SupportedType,
            ticketId: r.ticket_id ?? undefined,
            ticketSummary: r.ticket_summary ?? undefined,
            listingId: r.listing_id ?? undefined,
            listingSummary: r.listing_summary ?? undefined,
            connectionId: r.connection_id ?? undefined,
            storyId: r.story_id ?? undefined,
            message: r.message ?? undefined,
            reportReasons: r.report_reasons ?? undefined,
          });
          deliveredSet.add(r.id);
          persistDeliveredSet(deliveredSet);
          void markDelivered([r.id]);
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

