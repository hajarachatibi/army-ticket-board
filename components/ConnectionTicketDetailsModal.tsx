"use client";

import { useEffect, useMemo, useState } from "react";

import { formatPrice } from "@/lib/data/currencies";
import { supabase } from "@/lib/supabaseClient";

type SeatRow = {
  seatIndex: number;
  section: string;
  seatRow: string;
  seat: string;
  faceValuePrice: number;
  currency: string;
};

type ListingRow = {
  id: string;
  concertCity: string;
  concertDate: string;
  ticketSource: string;
  ticketingExperience: string;
  sellingReason: string;
  status: string;
  createdAt: string;
  priceExplanation: string | null;
  vip: boolean;
  loge: boolean;
  suite: boolean;
};

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function ConnectionTicketDetailsModal({
  open,
  onClose,
  connectionId,
}: {
  open: boolean;
  onClose: () => void;
  connectionId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);

  useEffect(() => {
    if (!open || !connectionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setListing(null);
      setSeats([]);
      const { data, error: e } = await supabase.rpc("connection_listing_details", { p_connection_id: connectionId });
      if (cancelled) return;
      setLoading(false);
      if (e) {
        setError(e.message);
        return;
      }
      if (!data) {
        setError("No details found.");
        return;
      }
      const d = data as any;
      const l = d?.listing as any;
      const s = Array.isArray(d?.seats) ? d.seats : [];
      setListing({
        id: String(l?.id ?? ""),
        concertCity: String(l?.concert_city ?? ""),
        concertDate: String(l?.concert_date ?? ""),
        ticketSource: String(l?.ticket_source ?? ""),
        ticketingExperience: String(l?.ticketing_experience ?? ""),
        sellingReason: String(l?.selling_reason ?? ""),
        status: String(l?.status ?? ""),
        createdAt: String(l?.created_at ?? ""),
        priceExplanation: l?.price_explanation != null ? String(l.price_explanation) : null,
        vip: Boolean(l?.vip ?? false),
        loge: Boolean(l?.loge ?? false),
        suite: Boolean(l?.suite ?? false),
      });
      setSeats(
        s.map((x: any) => ({
          seatIndex: Number(x?.seat_index ?? 1),
          section: String(x?.section ?? ""),
          seatRow: String(x?.seat_row ?? ""),
          seat: String(x?.seat ?? ""),
          faceValuePrice: Number(x?.face_value_price ?? 0),
          currency: String(x?.currency ?? "USD"),
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [connectionId, open]);

  const title = useMemo(() => {
    if (!listing) return "Ticket details";
    return `${listing.concertCity} · ${listing.concertDate}`;
  }, [listing]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-2xl cursor-default rounded-2xl border border-army-purple/20 bg-white p-5 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-bold text-army-purple">Ticket details</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{title}</p>
          </div>
          <button type="button" className="btn-army-outline" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
          {loading ? (
            <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : !listing ? (
            <p className="text-neutral-500 dark:text-neutral-400">No details found.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Concert</p>
                    <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                      {listing.concertCity} · {listing.concertDate}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Type</p>
                    <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                      {listing.loge ? "Loge" : listing.suite ? "Suite" : listing.vip ? "VIP" : "Standard"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Listing status</p>
                    <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{listing.status || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Created</p>
                    <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{formatDate(listing.createdAt)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 dark:border-army-purple/25 dark:bg-army-purple/10">
                <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Seller’s answers</p>
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-army-purple">Where did you buy?</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-neutral-700 dark:text-neutral-300">{listing.ticketSource || "—"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-army-purple">How was your ticketing experience?</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-neutral-700 dark:text-neutral-300">{listing.ticketingExperience || "—"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-army-purple">Why are you selling?</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-neutral-700 dark:text-neutral-300">{listing.sellingReason || "—"}</p>
                  </div>
                </div>
              </div>

              {listing.priceExplanation?.trim() && (
                <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                  <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Price explanation</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-700 dark:text-neutral-300">
                    {listing.priceExplanation.trim()}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                <h3 className="font-display text-lg font-bold text-army-purple">Seats</h3>
                {seats.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">No seats found.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {seats.map((s) => (
                      <div key={String(s.seatIndex)} className="rounded-xl border border-army-purple/15 bg-white p-3 dark:border-army-purple/25 dark:bg-neutral-900">
                        <p className="text-sm font-semibold text-army-purple">
                          Seat {s.seatIndex}: {s.section} · {s.seatRow} · {s.seat}
                        </p>
                        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{formatPrice(s.faceValuePrice, s.currency)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

