"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { ARIRANG_CITIES, ARIRANG_EVENTS } from "@/lib/data/arirang";
import { CURRENCY_OPTIONS } from "@/lib/data/currencies";
import type { Ticket } from "@/lib/data/tickets";
import { updateTicket } from "@/lib/supabase/tickets";
import Link from "next/link";
import { uploadTicketProofAttachment } from "@/lib/supabase/uploadTicketProofAttachment";

type SellTicketModalProps = {
  open: boolean;
  onClose: () => void;
  editTicket?: Ticket | null;
  onTicketAdded?: (ticket: Ticket) => void;
  onTicketUpdated?: (ticket: Ticket) => void;
};

export default function SellTicketModal({
  open,
  onClose,
  editTicket,
  onTicketAdded,
  onTicketUpdated,
}: SellTicketModalProps) {
  const { user } = useAuth();
  const [event, setEvent] = useState("");
  const [city, setCity] = useState("");
  const [day, setDay] = useState("");
  const [vip, setVip] = useState(false);
  const [section, setSection] = useState("");
  const [row, setRow] = useState("");
  const [seat, setSeat] = useState("");
  const [seatType, setSeatType] = useState<"Seat" | "Standing">("Seat");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [proofTicketPage, setProofTicketPage] = useState<File | null>(null);
  const [proofScreenRecording, setProofScreenRecording] = useState<File | null>(null);
  const [proofEmailScreenshot, setProofEmailScreenshot] = useState<File | null>(null);
  const [priceNote, setPriceNote] = useState("");

  const isEdit = !!editTicket;

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setFormError(null);
    setSubmitStatus(null);
    if (editTicket) {
      setEvent(editTicket.event);
      setCity(editTicket.city);
      setDay(editTicket.day);
      setVip(editTicket.vip);
      setSection(editTicket.section);
      setRow(editTicket.row);
      setSeat(editTicket.seat);
      setSeatType(editTicket.type);
      setQuantity(String(editTicket.quantity));
      setPrice(editTicket.price != null ? String(editTicket.price) : "");
      setCurrency(editTicket.currency ?? "USD");
    } else {
      setEvent("");
      setCity("");
      setDay("");
      setVip(false);
      setSection("");
      setRow("");
      setSeat("");
      setSeatType("Seat");
      setQuantity("1");
      setPrice("");
      setCurrency("USD");
      setProofTicketPage(null);
      setProofScreenRecording(null);
      setProofEmailScreenshot(null);
      setPriceNote("");
    }
  }, [open, editTicket]);

  if (!open) return null;

  const resetForm = () => {
    setEvent("");
    setCity("");
    setDay("");
    setVip(false);
    setSection("");
    setRow("");
    setSeat("");
    setSeatType("Seat");
    setQuantity("1");
    setPrice("");
    setCurrency("USD");
    setProofTicketPage(null);
    setProofScreenRecording(null);
    setProofEmailScreenshot(null);
    setPriceNote("");
    setSubmitStatus(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);
    const qty = Math.min(4, Math.max(1, parseInt(quantity, 10) || 1));
    const seatVal = seat.trim() || (qty > 1 ? `1-${qty}` : "1");
    const priceNum = Math.max(0, parseFloat(String(price).replace(/,/g, ".")) || 0);
    if (priceNum <= 0) {
      setFormError("Please enter a valid price (face value per ticket).");
      return;
    }

    if (!isEdit) {
      if (!proofTicketPage || !proofEmailScreenshot) {
        setFormError("Please upload the required proof screenshots before submitting.");
        return;
      }
      void submitNewTicket();
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && editTicket) {
        const { data, error } = await updateTicket(editTicket.id, {
          event,
          city,
          day,
          vip,
          quantity: qty,
          section,
          row,
          seat: seatVal,
          type: seatType,
          price: priceNum,
          currency,
        });
        if (error) throw new Error(error);
        if (data) onTicketUpdated?.(data);
      } else {
        // handled above
      }
      resetForm();
      onClose();
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("[SellTicketModal]", err);
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitNewTicket = async () => {
    if (!user) return;
    setFormError(null);
    setSubmitStatus(null);
    const qty = Math.min(4, Math.max(1, parseInt(quantity, 10) || 1));
    const seatVal = seat.trim() || (qty > 1 ? `1-${qty}` : "1");
    const priceNum = Math.max(0, parseFloat(String(price).replace(/,/g, ".")) || 0);
    if (priceNum <= 0) {
      setFormError("Please enter a valid price (face value per ticket).");
      return;
    }
    if (!proofTicketPage || !proofEmailScreenshot) {
      setFormError("Please upload the required proof screenshots before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const groupId = crypto.randomUUID();
      setSubmitStatus("Uploading ticket page screenshot…");
      const up1 = await uploadTicketProofAttachment({
        userId: user.id,
        groupId,
        kind: "tm_ticket_page",
        file: proofTicketPage,
      });
      if ("error" in up1) throw new Error(up1.error);

      setSubmitStatus("Uploading email screenshot…");
      const up3 = await uploadTicketProofAttachment({
        userId: user.id,
        groupId,
        kind: "tm_email_screenshot",
        file: proofEmailScreenshot,
      });
      if ("error" in up3) throw new Error(up3.error);

      let up2: { path: string } | null = null;
      if (proofScreenRecording) {
        setSubmitStatus("Uploading screen recording…");
        const r = await uploadTicketProofAttachment({
          userId: user.id,
          groupId,
          kind: "tm_screen_recording",
          file: proofScreenRecording,
        });
        if ("error" in r) throw new Error(r.error);
        up2 = r;
      }

      setSubmitStatus("Submitting ticket for admin review…");
      const res = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          city,
          day,
          vip,
          quantity: qty,
          section,
          row,
          seat: seatVal,
          type: seatType,
          price: priceNum,
          currency,
          proofTmTicketPagePath: up1.path,
          proofTmScreenRecordingPath: up2?.path ?? null,
          proofTmEmailScreenshotPath: up3.path,
          proofPriceNote: priceNote.trim() || null,
        }),
      });
      const j = (await res.json().catch(() => null)) as { data?: any; error?: string } | null;
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      const raw = j?.data;
      if (!raw) throw new Error("No ticket returned");

      onTicketAdded?.({
        id: String(raw.id),
        event: String(raw.event),
        city: String(raw.city),
        day: String(raw.day),
        vip: Boolean(raw.vip),
        quantity: Number(raw.quantity),
        section: String(raw.section),
        row: String(raw.seat_row),
        seat: String(raw.seat),
        type: String(raw.type) as Ticket["type"],
        status: String(raw.status) as Ticket["status"],
        ownerId: raw.owner_id ?? null,
        price: Number(raw.price ?? 0),
        currency: String(raw.currency ?? "USD"),
        listingStatus: raw.listing_status ?? undefined,
      } as Ticket);
      resetForm();
      onClose();
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("[SellTicketModal]", err);
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
      setSubmitStatus(null);
    }
  };

  const handleClose = () => {
    setFormError(null);
    setSubmitting(false);
    setSubmitStatus(null);
    resetForm();
    onClose();
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4 opacity-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sell-ticket-modal-title"
      onClick={handleClose}
    >
      <div
        className="modal-panel max-h-[90vh] w-full max-w-lg cursor-default overflow-y-auto rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sell-ticket-modal-title" className="font-display text-xl font-bold text-army-purple">
          {isEdit ? "Edit ticket" : "Sell ticket"}
        </h2>
        {!isEdit && (
          <div className="mt-4 rounded-2xl border border-army-purple/15 bg-white/80 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-neutral-900/80 dark:text-neutral-300">
            <p className="font-semibold text-army-purple">Ticketmaster (TM) or SeatGeek (SG) proof requirements</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Screenshot of TM/SG ticket page (with today’s date and your name handwritten)</li>
              <li>Screen recording scrolling TM/SG app <span className="font-semibold">(Optional but will make review faster)</span></li>
              <li>Screenshot of TM/SG email (sensitive info hidden) to prove face value</li>
            </ul>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">If it’s not face value, please add a note explaining why (fees, etc.).</p>
          </div>
        )}
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <strong>Face value only.</strong> Non–face-value listings will be reported and may result in a ban.
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="sell-event" className="block text-sm font-semibold text-army-purple">
              Event
            </label>
            <select
              id="sell-event"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              className="input-army mt-1"
              required
            >
              <option value="">Select event</option>
              {ARIRANG_EVENTS.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sell-city" className="block text-sm font-semibold text-army-purple">
              City
            </label>
            <select
              id="sell-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input-army mt-1"
              required
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
            <label htmlFor="sell-day" className="block text-sm font-semibold text-army-purple">
              Day of event
            </label>
            <input
              id="sell-day"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="input-army mt-1"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sell-vip"
              checked={vip}
              onChange={(e) => setVip(e.target.checked)}
              className="h-4 w-4 rounded border-army-purple/30 text-army-purple focus:ring-army-purple"
            />
            <label htmlFor="sell-vip" className="text-sm font-semibold text-army-purple">
              VIP
            </label>
          </div>
          <div>
            <label htmlFor="sell-section" className="block text-sm font-semibold text-army-purple">
              Section
            </label>
            <input
              id="sell-section"
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. A"
              className="input-army mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="sell-row" className="block text-sm font-semibold text-army-purple">
              Row
            </label>
            <input
              id="sell-row"
              type="text"
              value={row}
              onChange={(e) => setRow(e.target.value)}
              placeholder="e.g. 12"
              className="input-army mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="sell-seat" className="block text-sm font-semibold text-army-purple">
              Seat number
            </label>
            <input
              id="sell-seat"
              type="text"
              value={seat}
              onChange={(e) => setSeat(e.target.value)}
              placeholder="e.g. 1, 1-2, 12A"
              className="input-army mt-1"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Seat type</label>
            <select
              value={seatType}
              onChange={(e) => setSeatType(e.target.value as "Seat" | "Standing")}
              className="input-army mt-1"
            >
              <option value="Seat">Seat</option>
              <option value="Standing">Standing</option>
            </select>
          </div>
          <div>
            <label htmlFor="sell-quantity" className="block text-sm font-semibold text-army-purple">
              Quantity
            </label>
            <input
              id="sell-quantity"
              type="number"
              min={1}
              max={4}
              step={1}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => {
                // Keep it typable (allow empty/partial edits), validate on submit.
                setQuantity(e.target.value);
              }}
              className="input-army mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="sell-currency" className="block text-sm font-semibold text-army-purple">
              Currency
            </label>
            <select
              id="sell-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="input-army mt-1"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol}) — {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sell-price" className="block text-sm font-semibold text-army-purple">
              Price (face value per ticket)
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
                {CURRENCY_OPTIONS.find((c) => c.code === currency)?.symbol ?? ""}
              </span>
              <input
                id="sell-price"
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => { setPrice(e.target.value); setFormError(null); }}
                placeholder="e.g. 150 or 99.50"
                className="input-army w-full pl-7"
                required
              />
            </div>
          </div>

          {!isEdit && (
            <>
              <div className="rounded-2xl border border-army-purple/15 bg-white/70 p-4 dark:border-army-purple/25 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-army-purple">Upload proofs</p>
                <div className="mt-3 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-army-purple">
                      Screenshot of TM/SG ticket page (required)
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="mt-2 block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-army-purple file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-army-700 dark:text-neutral-300"
                      onChange={(e) => setProofTicketPage(e.target.files?.[0] ?? null)}
                    />
                    {proofTicketPage && (
                      <button type="button" className="mt-2 btn-army-outline" onClick={() => setProofTicketPage(null)}>
                        Remove file
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-army-purple">
                      Screen recording scrolling TM/SG app <span className="font-normal text-neutral-500">(optional)</span>
                    </label>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="mt-2 block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-army-purple file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-army-700 dark:text-neutral-300"
                      onChange={(e) => setProofScreenRecording(e.target.files?.[0] ?? null)}
                    />
                    {proofScreenRecording && (
                      <button type="button" className="mt-2 btn-army-outline" onClick={() => setProofScreenRecording(null)}>
                        Remove file
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-army-purple">
                      Screenshot of TM/SG email (required)
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="mt-2 block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-army-purple file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-army-700 dark:text-neutral-300"
                      onChange={(e) => setProofEmailScreenshot(e.target.files?.[0] ?? null)}
                    />
                    {proofEmailScreenshot && (
                      <button type="button" className="mt-2 btn-army-outline" onClick={() => setProofEmailScreenshot(null)}>
                        Remove file
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-army-purple">
                      Note if it’s not face value (fees, etc.) <span className="font-normal text-neutral-500">(optional)</span>
                    </label>
                    <textarea
                      className="input-army mt-2 resize-none"
                      rows={3}
                      value={priceNote}
                      onChange={(e) => setPriceNote(e.target.value)}
                      placeholder="If your listed price differs due to fees, explain here (hide sensitive info)."
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          {formError && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {formError}
            </p>
          )}
          {submitting && submitStatus && (
            <div className="rounded-lg border border-army-purple/15 bg-army-purple/5 px-3 py-2 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-200">
              {submitStatus}
            </div>
          )}
          {!isEdit && (
            <div className="rounded-lg border border-army-purple/15 bg-army-purple/5 px-3 py-2 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-300">
              Friendly note: your ticket will be reviewed by an admin within 24 hours. We may message you to confirm proof—please reply within 24 hours to avoid rejection.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="btn-army-outline">
              Cancel
            </button>
            <button type="submit" className="btn-army" disabled={submitting}>
              {submitting ? "…" : isEdit ? "Update" : "List ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
