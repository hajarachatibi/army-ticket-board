"use client";

import { PayPalButtons, PayPalScriptProvider, type ReactPayPalScriptOptions, FUNDING } from "@paypal/react-paypal-js";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DonationConfigResponse = {
  ok: true;
  enabled: boolean;
  paypalClientId: string | null;
  currency: string;
  allowedCurrencies: string[];
  mode: "tiers" | "custom";
  amount: string;
  tiers: string[];
  minAmount: string;
  maxAmount: string;
  environment: "sandbox" | "live";
  enableFunding: string | null;
};

type ApiOk<T> = T & { ok: true };
type ApiErr = { ok: false; error: string };

function formatMoney(currency: string, value: string) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(safe);
}

export default function PayPalDonationWidget() {
  const router = useRouter();
  const [cfg, setCfg] = useState<DonationConfigResponse | null>(null);
  const [cfgError, setCfgError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCfgError(null);
      const res = await fetch("/api/donations/config", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as DonationConfigResponse | null;
      if (cancelled) return;
      if (!res.ok || !j?.ok) {
        setCfgError("Donations are not available right now.");
        return;
      }
      setCfg(j);
      setSelectedTier(j.amount);
      setCustomAmount(j.amount);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountLabel = useMemo(() => {
    if (!cfg) return "$—";
    const c = cfg.currency;
    const a = cfg.mode === "custom" ? customAmount || cfg.amount : selectedTier || cfg.amount;
    return formatMoney(c, a);
  }, [cfg, selectedTier, customAmount]);

  // USD only; client cannot override currency (enforced server-side).
  const activeCurrency = useMemo(() => (cfg ? cfg.currency : null), [cfg]);

  // When currency changes, PayPalScriptProvider remounts (new key) and the SDK reloads. Show loading until buttons can render.
  const prevCurrencyRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (activeCurrency === null) return;
    if (prevCurrencyRef.current !== null && prevCurrencyRef.current !== activeCurrency) {
      setPaypalLoading(true);
      const t = setTimeout(() => setPaypalLoading(false), 3000);
      prevCurrencyRef.current = activeCurrency;
      return () => clearTimeout(t);
    }
    prevCurrencyRef.current = activeCurrency;
  }, [activeCurrency]);

  const activeTier = useMemo(() => {
    if (!cfg) return null;
    const a = String(selectedTier || cfg.amount || "").trim();
    return cfg.tiers.includes(a) ? a : cfg.amount;
  }, [cfg, selectedTier]);

  const activeAmount = useMemo(() => {
    if (!cfg) return null;
    if (cfg.mode === "tiers") return activeTier;
    const raw = String(customAmount || "").trim();
    return raw || cfg.amount;
  }, [cfg, activeTier, customAmount]);

  const paypalOptions = useMemo((): ReactPayPalScriptOptions | null => {
    if (!cfg?.paypalClientId || !activeCurrency) return null;

    // SECURITY:
    // - It's OK to expose the PayPal *client id* in the browser.
    // - The PayPal *secret* never appears in client code; we only use it in server routes.
    // - The actual order amount/payee are enforced server-side, so "button hijacking" via client
    //   tampering cannot redirect funds or change the amount charged.
    // - Always request "card" so the credit/debit card button is eligible when the account/region supports it.
    const extraFunding = cfg.enableFunding ? cfg.enableFunding.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const enableFunding = ["card", ...extraFunding].filter((v, i, a) => a.indexOf(v) === i).join(",");
    return {
      clientId: cfg.paypalClientId,
      currency: activeCurrency,
      intent: "capture",
      components: "buttons,funding-eligibility",
      enableFunding,
    };
  }, [cfg, activeCurrency]);

  const close = () => {
    setOpen(false);
    setError(null);
    setSubmitting(false);
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-army" onClick={() => setOpen(true)}>
          Donate
        </button>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Optional · Securely processed via PayPal
        </p>
      </div>
      {cfgError && (
        <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {cfgError}
        </p>
      )}

      {open && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4 opacity-100"
          role="dialog"
          aria-modal="true"
          aria-labelledby="donation-modal-title"
          onClick={close}
        >
          <div
            className="modal-panel w-full max-w-md max-h-[90vh] overflow-y-auto cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="donation-modal-title" className="font-display text-xl font-bold text-army-purple">
              Confirm donation
            </h2>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
              You are donating <strong>{amountLabel}</strong>{" "}
              <span className="font-semibold text-army-purple">(USD)</span> to support the app. This is optional and
              securely processed via PayPal.
            </p>

            {cfg?.mode === "tiers" && cfg?.tiers?.length ? (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-army-purple" htmlFor="donation-tier">
                  Donation amount (USD)
                </label>
                <select
                  id="donation-tier"
                  className="input-army mt-1"
                  value={activeTier ?? ""}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  disabled={submitting}
                >
                  {cfg.tiers.map((t) => (
                    <option key={t} value={t}>
                      {activeCurrency ? formatMoney(activeCurrency, t) : t}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  Pick a preset tier (no custom amounts).
                </p>
              </div>
            ) : null}

            {cfg?.mode === "custom" ? (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-army-purple" htmlFor="donation-amount">
                  Donation amount (USD)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="donation-amount"
                    inputMode="decimal"
                    className="input-army flex-1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={cfg.amount}
                    disabled={submitting}
                  />
                  <span className="shrink-0 text-sm font-semibold text-army-purple">USD</span>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-300">
              <p className="font-semibold text-army-purple">Payment methods</p>
              <ul className="mt-2 list-disc pl-5 text-xs text-neutral-600 dark:text-neutral-400">
                <li>Pay with your PayPal account</li>
                <li>Pay with major credit/debit cards (no PayPal account required)</li>
                <li>Apple Pay / Google Pay may appear if your device/account is eligible</li>
              </ul>
              <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
                <strong className="text-neutral-700 dark:text-neutral-300">Card form:</strong> Tap or click into each field to enter your details—they are active even if they look light. On supported phones, a &quot;Scan card&quot; option may appear in the form. No shipping needed; only card details (and sometimes billing) are requested.
              </p>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </p>
            )}

            {!cfg?.enabled || !paypalOptions ? (
              <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
                Donations aren’t configured yet.
              </p>
            ) : paypalLoading ? (
              <div className="mt-4 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 text-sm text-neutral-700 dark:text-neutral-300">
                <p>Loading payment options for {activeCurrency}…</p>
                {cfg?.environment === "sandbox" && (
                  <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                    In test mode, buttons may only appear for USD. Switch back to USD if they don’t load.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {/* Changing currency requires reloading the PayPal JS SDK (key forces remount). */}
                <PayPalScriptProvider options={paypalOptions} key={paypalOptions.currency}>
                  {/* PayPal button */}
                  <PayPalButtons
                    fundingSource={FUNDING.PAYPAL}
                    style={{ layout: "vertical", shape: "rect", label: "donate" }}
                    disabled={submitting}
                    createOrder={async () => {
                      setSubmitting(true);
                      setError(null);
                      const res = await fetch("/api/paypal/create-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ amount: activeAmount }),
                      });
                      const j = (await res.json().catch(() => null)) as
                        | ApiOk<{ orderId: string }>
                        | ApiErr
                        | null;
                      if (!res.ok || !j || !j.ok) {
                        setSubmitting(false);
                        throw new Error((j && "error" in j && j.error) || `Create order failed (HTTP ${res.status})`);
                      }
                      return j.orderId;
                    }}
                    onApprove={async (data) => {
                      setError(null);
                      const res = await fetch("/api/paypal/capture-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderId: data.orderID }),
                      });
                      const j = (await res.json().catch(() => null)) as
                        | ApiOk<{ orderId: string; captureId: string | null }>
                        | ApiErr
                        | null;
                      if (!res.ok || !j || !j.ok) {
                        setSubmitting(false);
                        setError((j && "error" in j && j.error) || `Capture failed (HTTP ${res.status})`);
                        return;
                      }
                      // Server has captured + verified the amount/payee. Now we can show thanks.
                      close();
                      router.push(`/support/thank-you?orderId=${encodeURIComponent(j.orderId)}${j.captureId ? `&captureId=${encodeURIComponent(j.captureId)}` : ""}`);
                    }}
                    onCancel={() => {
                      setSubmitting(false);
                    }}
                    onError={(e) => {
                      setSubmitting(false);
                      setError(e instanceof Error ? e.message : "Payment failed.");
                    }}
                  />

                  {/* Card button (pay with card without a PayPal account when eligible) */}
                  <PayPalButtons
                    fundingSource={FUNDING.CARD}
                    style={{ layout: "vertical", shape: "rect" }}
                    disabled={submitting}
                    createOrder={async () => {
                      setSubmitting(true);
                      setError(null);
                      const res = await fetch("/api/paypal/create-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ amount: activeAmount }),
                      });
                      const j = (await res.json().catch(() => null)) as
                        | ApiOk<{ orderId: string }>
                        | ApiErr
                        | null;
                      if (!res.ok || !j || !j.ok) {
                        setSubmitting(false);
                        throw new Error((j && "error" in j && j.error) || `Create order failed (HTTP ${res.status})`);
                      }
                      return j.orderId;
                    }}
                    onApprove={async (data) => {
                      setError(null);
                      const res = await fetch("/api/paypal/capture-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderId: data.orderID }),
                      });
                      const j = (await res.json().catch(() => null)) as
                        | ApiOk<{ orderId: string; captureId: string | null }>
                        | ApiErr
                        | null;
                      if (!res.ok || !j || !j.ok) {
                        setSubmitting(false);
                        setError((j && "error" in j && j.error) || `Capture failed (HTTP ${res.status})`);
                        return;
                      }
                      close();
                      router.push(`/support/thank-you?orderId=${encodeURIComponent(j.orderId)}${j.captureId ? `&captureId=${encodeURIComponent(j.captureId)}` : ""}`);
                    }}
                    onCancel={() => setSubmitting(false)}
                    onError={(e) => {
                      setSubmitting(false);
                      setError(e instanceof Error ? e.message : "Payment failed.");
                    }}
                  />
                </PayPalScriptProvider>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className="btn-army-outline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

