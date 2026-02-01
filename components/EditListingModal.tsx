"use client";

import { useEffect, useMemo, useState } from "react";

import type { MyListing } from "@/lib/supabase/listings";

type SeatDraft = {
  section: string;
  row: string;
  seat: string;
  faceValuePrice: string;
  currency: string;
};

export default function EditListingModal({
  open,
  onClose,
  listing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  listing: MyListing | null;
  onSaved: () => void;
}) {
  const [concertCity, setConcertCity] = useState("");
  const [concertDate, setConcertDate] = useState("");
  const [ticketSource, setTicketSource] = useState("Ticketmaster");
  const [ticketingExperience, setTicketingExperience] = useState("");
  const [sellingReason, setSellingReason] = useState("");
  const [priceExplanation, setPriceExplanation] = useState("");
  const [seats, setSeats] = useState<SeatDraft[]>([{ section: "", row: "", seat: "", faceValuePrice: "", currency: "USD" }]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !listing) return;
    setConcertCity(listing.concertCity ?? "");
    setConcertDate(listing.concertDate ?? "");
    setTicketSource(listing.ticketSource ?? "Ticketmaster");
    setTicketingExperience(listing.ticketingExperience ?? "");
    setSellingReason(listing.sellingReason ?? "");
    setPriceExplanation(listing.priceExplanation ?? "");
    setSeats(
      (listing.seats?.length ? listing.seats : [{ seatIndex: 1, section: "", seatRow: "", seat: "", faceValuePrice: 0, currency: "USD" }]).map((s) => ({
        section: s.section ?? "",
        row: s.seatRow ?? "",
        seat: s.seat ?? "",
        faceValuePrice: String(s.faceValuePrice ?? ""),
        currency: s.currency ?? "USD",
      }))
    );
    setError(null);
    setSubmitting(false);
  }, [listing, open]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!listing?.id) return false;
    if (!concertCity.trim() || !concertDate.trim()) return false;
    if (!ticketSource.trim()) return false;
    if (!ticketingExperience.trim() || !sellingReason.trim()) return false;
    if (seats.length < 1 || seats.length > 4) return false;
    for (const s of seats) {
      if (!s.section.trim() || !s.row.trim() || !s.seat.trim()) return false;
      const p = Number(s.faceValuePrice);
      if (!Number.isFinite(p) || p <= 0) return false;
      if (!s.currency.trim()) return false;
    }
    return true;
  }, [concertCity, concertDate, listing?.id, sellingReason, seats, submitting, ticketSource, ticketingExperience]);

  const close = () => {
    if (submitting) return;
    setError(null);
    onClose();
  };

  const addSeat = () => {
    if (seats.length >= 4) return;
    setSeats((prev) => [...prev, { section: "", row: "", seat: "", faceValuePrice: "", currency: prev[0]?.currency || "USD" }]);
  };

  const removeSeat = (idx: number) => {
    if (seats.length <= 1) return;
    setSeats((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!canSubmit || !listing) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/listings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          concertCity: concertCity.trim(),
          concertDate: concertDate.trim(),
          ticketSource: ticketSource.trim(),
          ticketingExperience: ticketingExperience.trim(),
          sellingReason: sellingReason.trim(),
          priceExplanation: priceExplanation.trim() || null,
          seats: seats.map((s) => ({
            section: s.section.trim(),
            row: s.row.trim(),
            seat: s.seat.trim(),
            faceValuePrice: Number(s.faceValuePrice),
            currency: s.currency.trim(),
          })),
        }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) {
        setError(j?.error || `HTTP ${res.status}`);
        return;
      }
      onSaved();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update listing");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4" onClick={close}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-army-purple">Edit listing</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Update or correct your listing details.</p>
          </div>
          <button type="button" className="btn-army-outline" onClick={close} disabled={submitting}>
            Close
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-army-purple">Concert city</label>
            <input className="input-army mt-2" value={concertCity} onChange={(e) => setConcertCity(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Concert date</label>
            <input type="date" className="input-army mt-2" value={concertDate} onChange={(e) => setConcertDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Ticket source</label>
            <select className="input-army mt-2" value={ticketSource} onChange={(e) => setTicketSource(e.target.value)} disabled={submitting}>
              <option value="Ticketmaster">Ticketmaster</option>
              <option value="Seatgeek">Seatgeek</option>
              <option value="StubHub">StubHub</option>
              <option value="Viagogo">Viagogo</option>
              <option value="Interpark">Interpark</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-army-purple">How was your ticketing experience?</label>
            <textarea className="input-army mt-2 resize-none" rows={3} value={ticketingExperience} onChange={(e) => setTicketingExperience(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Why are you selling?</label>
            <textarea className="input-army mt-2 resize-none" rows={3} value={sellingReason} onChange={(e) => setSellingReason(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Price explanation (optional)</label>
            <textarea className="input-army mt-2 resize-none" rows={3} value={priceExplanation} onChange={(e) => setPriceExplanation(e.target.value)} />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-army-purple/15 bg-white/80 p-4 dark:border-army-purple/25 dark:bg-neutral-900/60">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-army-purple">Seat details (max 4)</p>
            <button type="button" className="btn-army-outline" onClick={addSeat} disabled={submitting || seats.length >= 4}>
              Add seat
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {seats.map((s, idx) => (
              <div key={idx} className="rounded-xl border border-army-purple/15 bg-white p-4 dark:border-army-purple/25 dark:bg-neutral-900">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-army-purple">Seat {idx + 1}</p>
                  <button type="button" className="btn-army-outline" onClick={() => removeSeat(idx)} disabled={submitting || seats.length <= 1}>
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Section</label>
                    <input
                      className="input-army mt-1"
                      value={s.section}
                      onChange={(e) => setSeats((prev) => prev.map((x, i) => (i === idx ? { ...x, section: e.target.value } : x)))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Row</label>
                    <input
                      className="input-army mt-1"
                      value={s.row}
                      onChange={(e) => setSeats((prev) => prev.map((x, i) => (i === idx ? { ...x, row: e.target.value } : x)))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Seat</label>
                    <input
                      className="input-army mt-1"
                      value={s.seat}
                      onChange={(e) => setSeats((prev) => prev.map((x, i) => (i === idx ? { ...x, seat: e.target.value } : x)))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Face value</label>
                      <input
                        className="input-army mt-1"
                        value={s.faceValuePrice}
                        onChange={(e) => setSeats((prev) => prev.map((x, i) => (i === idx ? { ...x, faceValuePrice: e.target.value } : x)))}
                        inputMode="decimal"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Currency</label>
                      <input
                        className="input-army mt-1"
                        value={s.currency}
                        onChange={(e) => setSeats((prev) => prev.map((x, i) => (i === idx ? { ...x, currency: e.target.value } : x)))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-army-outline" onClick={close} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="btn-army" onClick={submit} disabled={!canSubmit}>
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

