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
  sellerId: string | null;
  sellerEmail: string | null;
  concertCity: string;
  concertDate: string;
  status: string;
  createdAt: string;
  lockedBy: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
};

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function AdminListingModal({
  open,
  onClose,
  listingId,
}: {
  open: boolean;
  onClose: () => void;
  listingId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);

  useEffect(() => {
    if (!open || !listingId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setListing(null);
      setSeats([]);
      const { data, error: e } = await supabase.rpc("admin_listing_details", { p_listing_id: listingId });
      if (cancelled) return;
      setLoading(false);
      if (e) {
        setError(e.message);
        return;
      }
      if (!data) {
        setError("No listing found.");
        return;
      }
      const d = data as any;
      const l = d?.listing as any;
      const s = Array.isArray(d?.seats) ? d.seats : [];
      setListing({
        id: String(l?.id ?? listingId),
        sellerId: l?.seller_id != null ? String(l.seller_id) : null,
        sellerEmail: l?.seller_email != null ? String(l.seller_email) : null,
        concertCity: String(l?.concert_city ?? ""),
        concertDate: String(l?.concert_date ?? ""),
        status: String(l?.status ?? ""),
        createdAt: String(l?.created_at ?? ""),
        lockedBy: l?.locked_by != null ? String(l.locked_by) : null,
        lockedAt: l?.locked_at != null ? String(l.locked_at) : null,
        lockExpiresAt: l?.lock_expires_at != null ? String(l.lock_expires_at) : null,
      });
      setSeats(
        s.map((x: any) => ({
          seatIndex: Number(x?.seat_index ?? 0),
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
  }, [listingId, open]);

  const title = useMemo(() => {
    if (!listing) return "Listing";
    const parts = [listing.concertCity, listing.concertDate].filter(Boolean);
    return parts.length ? `Listing: ${parts.join(" · ")}` : "Listing";
  }, [listing]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-2xl cursor-default rounded-2xl border border-army-purple/20 bg-white p-4 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-bold text-army-purple">{title}</h2>
            {listing?.id && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">ID: {listing.id}</p>}
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
            <p className="text-neutral-500 dark:text-neutral-400">No listing found.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Status</p>
                    <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{listing.status || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Created</p>
                    <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{formatDate(listing.createdAt)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Seller</p>
                    <p className="mt-1 break-words text-sm text-neutral-800 dark:text-neutral-200">{listing.sellerEmail || listing.sellerId || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Locked by</p>
                    <p className="mt-1 break-words text-sm text-neutral-800 dark:text-neutral-200">{listing.lockedBy || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-army-purple/70">Lock expires</p>
                    <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{formatDate(listing.lockExpiresAt)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/80">
                <h3 className="font-display text-lg font-bold text-army-purple">Seats</h3>
                {seats.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">No seats found.</p>
                ) : (
                  <div className="mt-3 overflow-hidden rounded-xl border border-army-purple/15 dark:border-army-purple/25">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-army-purple/15 bg-army-purple/5 dark:border-army-purple/25 dark:bg-army-purple/10">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">#</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Section</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Row</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Seat</th>
                          <th className="px-3 py-2 font-semibold text-army-purple dark:text-army-300">Face value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seats.map((s) => (
                          <tr key={`${s.seatIndex}-${s.section}-${s.seatRow}-${s.seat}`} className="border-b border-army-purple/10 last:border-0 dark:border-army-purple/20">
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">{s.seatIndex + 1}</td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{s.section || "—"}</td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{s.seatRow || "—"}</td>
                            <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{s.seat || "—"}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-neutral-800 dark:text-neutral-200">
                              {formatPrice(s.faceValuePrice, s.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

