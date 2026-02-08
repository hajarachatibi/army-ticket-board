"use client";

import { useMemo, useState } from "react";

import { ARIRANG_CITIES } from "@/lib/data/arirang";
import { parsePrice } from "@/lib/parsePrice";

type SeatDraft = {
  section: string;
  row: string;
  seat: string;
  faceValuePrice: string;
  currency: string;
};

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "KRW"] as const;

export default function PostListingModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [concertCity, setConcertCity] = useState("");
  const [concertDate, setConcertDate] = useState("");
  const [ticketSource, setTicketSource] = useState("Ticketmaster");
  const [listingType, setListingType] = useState<"standard" | "vip" | "loge" | "suite">("standard");
  const [ticketingExperience, setTicketingExperience] = useState("");
  const [sellingReason, setSellingReason] = useState("");
  const [priceExplanation, setPriceExplanation] = useState("");

  const [seats, setSeats] = useState<SeatDraft[]>([
    { section: "", row: "", seat: "", faceValuePrice: "", currency: "USD" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNoSeatsModal, setShowNoSeatsModal] = useState(false);

  const hasValidSeats = useMemo(() => {
    if (seats.length < 1) return false;
    const valid = seats.filter(
      (s) =>
        s.section.trim() &&
        s.row.trim() &&
        s.seat.trim() &&
        Number.isFinite(parsePrice(s.faceValuePrice)) &&
        (parsePrice(s.faceValuePrice) ?? 0) > 0 &&
        s.currency.trim()
    );
    return valid.length >= 1;
  }, [seats]);

  const canSubmitOther = useMemo(() => {
    if (submitting) return false;
    if (!concertCity.trim() || !concertDate.trim()) return false;
    if (!ticketSource.trim()) return false;
    if (!ticketingExperience.trim() || !sellingReason.trim()) return false;
    if (seats.length < 1 || seats.length > 4) return false;
    return true;
  }, [concertCity, concertDate, sellingReason, seats.length, submitting, ticketSource, ticketingExperience]);

  const canSubmit = useMemo(() => {
    if (!canSubmitOther) return false;
    return hasValidSeats;
  }, [canSubmitOther, hasValidSeats]);

  const reset = () => {
    setConcertCity("");
    setConcertDate("");
    setTicketSource("Ticketmaster");
    setListingType("standard");
    setTicketingExperience("");
    setSellingReason("");
    setPriceExplanation("");
    setSeats([{ section: "", row: "", seat: "", faceValuePrice: "", currency: "USD" }]);
    setSubmitting(false);
    setError(null);
    setShowNoSeatsModal(false);
  };

  const close = () => {
    if (submitting) return;
    reset();
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
    if (!canSubmit) return;
    if (!hasValidSeats) {
      setShowNoSeatsModal(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/listings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concertCity: concertCity.trim(),
          concertDate: concertDate.trim(),
          ticketSource: ticketSource.trim(),
          vip: listingType === "vip",
          loge: listingType === "loge",
          suite: listingType === "suite",
          ticketingExperience: ticketingExperience.trim(),
          sellingReason: sellingReason.trim(),
          priceExplanation: priceExplanation.trim() || null,
          seats: seats.map((s) => ({
            section: s.section.trim(),
            row: s.row.trim(),
            seat: s.seat.trim(),
            faceValuePrice: parsePrice(s.faceValuePrice) || 0,
            currency: s.currency.trim(),
          })),
        }),
      });
      const j = (await res.json().catch(() => null)) as { data?: { listingId?: string }; error?: string } | null;
      if (!res.ok) {
        setError(j?.error || `HTTP ${res.status}`);
        return;
      }
      onCreated();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create listing");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4" onClick={close}>
      <div className="modal-panel w-full max-w-2xl max-h-[85vh] overflow-y-auto cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-army-purple">Post Ticket (Listing)</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Your listing will appear in All Listings after <span className="font-semibold">2 minutes</span> of processing.
            </p>
          </div>
          <button type="button" className="btn-army-outline" onClick={close} disabled={submitting}>
            Close
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error.includes("already exists") && error.includes("under your listings") ? (
              <>
                <p className="font-semibold">Duplicate listing</p>
                <p className="mt-1">{error}</p>
              </>
            ) : (
              error
            )}
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-army-purple">Concert city</label>
            <select
              className="input-army mt-2 w-full"
              value={concertCity}
              onChange={(e) => setConcertCity(e.target.value)}
              required
              disabled={submitting}
            >
              <option value="">Select city</option>
              {ARIRANG_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Concert date</label>
            <input type="date" className="input-army mt-2" value={concertDate} onChange={(e) => setConcertDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Listing type</label>
            <select
              id="post-listing-type"
              value={listingType}
              onChange={(e) => setListingType(e.target.value as "standard" | "vip" | "loge" | "suite")}
              className="input-army mt-2"
              disabled={submitting}
            >
              <option value="standard">Standard</option>
              <option value="vip">VIP (e.g. sound check, VIP package)</option>
              <option value="loge">Loge</option>
              <option value="suite">Suite</option>
            </select>
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
            <label className="block text-sm font-semibold text-army-purple">
              Price explanation (optional)
            </label>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              If your total is not exactly face value (fees, taxes, etc.), explain why here.
            </p>
            <textarea
              className="input-army mt-2 resize-none"
              rows={3}
              value={priceExplanation}
              onChange={(e) => setPriceExplanation(e.target.value)}
              placeholder="Optional…"
            />
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
                      onChange={(e) =>
                        setSeats((prev) => prev.map((x, i) => (i === idx ? { ...x, section: e.target.value } : x)))
                      }
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
                        onChange={(e) =>
                          setSeats((prev) => prev.map((x, i) => (i === idx ? { ...x, faceValuePrice: e.target.value } : x)))
                        }
                        inputMode="decimal"
                        placeholder="e.g. 754.69 or 754,69"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-army-purple/70">Currency</label>
                      <select
                        className="input-army mt-1"
                        value={s.currency}
                        onChange={(e) => setSeats((prev) => prev.map((x, i) => (i === idx ? { ...x, currency: e.target.value } : x)))}
                        disabled={submitting}
                      >
                        {COMMON_CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
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
          <button type="button" className="btn-army" onClick={submit} disabled={!canSubmitOther}>
            {submitting ? "Posting…" : "Post listing"}
          </button>
        </div>
      </div>

      {showNoSeatsModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowNoSeatsModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-army-purple">Add at least one seat</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Listings must have at least one seat with section, row, seat, and face value. Fill in the seat details above or tap Add seat.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-army-outline" onClick={() => setShowNoSeatsModal(false)}>
                OK
              </button>
              <button
                type="button"
                className="btn-army"
                onClick={() => {
                  addSeat();
                  setShowNoSeatsModal(false);
                }}
              >
                Add seat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

