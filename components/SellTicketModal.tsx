"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { ARIRANG_CITIES, ARIRANG_EVENTS } from "@/lib/data/arirang";
import { CURRENCY_OPTIONS } from "@/lib/data/currencies";
import type { Ticket } from "@/lib/data/tickets";
import { insertTicket, updateTicket } from "@/lib/supabase/tickets";

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
  const { user, getAccessToken } = useAuth();
  const [event, setEvent] = useState("");
  const [city, setCity] = useState("");
  const [day, setDay] = useState("");
  const [vip, setVip] = useState(false);
  const [section, setSection] = useState("");
  const [row, setRow] = useState("");
  const [seat, setSeat] = useState("");
  const [seatType, setSeatType] = useState<"Seat" | "Standing">("Seat");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editTicket;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (editTicket) {
      setEvent(editTicket.event);
      setCity(editTicket.city);
      setDay(editTicket.day);
      setVip(editTicket.vip);
      setSection(editTicket.section);
      setRow(editTicket.row);
      setSeat(editTicket.seat);
      setSeatType(editTicket.type);
      setQuantity(editTicket.quantity);
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
      setQuantity(1);
      setPrice("");
      setCurrency("USD");
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
    setQuantity(1);
    setPrice("");
    setCurrency("USD");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);
    const seatVal = seat.trim() || (quantity > 1 ? `1-${quantity}` : "1");
    const priceNum = Math.max(0, parseFloat(String(price).replace(/,/g, ".")) || 0);
    if (priceNum <= 0) {
      setFormError("Please enter a valid price (face value per ticket).");
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
          quantity,
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
        const token = await getAccessToken();
        if (!token) {
          setFormError("Session expired. Please refresh the page and try again.");
          return;
        }
        const { data, error } = await insertTicket(
          {
            event,
            city,
            day,
            vip,
            quantity,
            section,
            row,
            seat: seatVal,
            type: seatType,
            ownerId: user.id,
            price: priceNum,
            currency,
          },
          token
        );
        if (error) throw new Error(error);
        if (data) onTicketAdded?.(data);
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

  const handleClose = () => {
    setFormError(null);
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
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 1)}
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
          {formError && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {formError}
            </p>
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
