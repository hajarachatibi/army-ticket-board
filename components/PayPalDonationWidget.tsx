"use client";

import { PayPalButtons, PayPalScriptProvider, type PayPalScriptOptions, FUNDING } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type DonationConfigResponse = {
  ok: true;
  enabled: boolean;
  paypalClientId: string | null;
  currency: string;
  allowedCurrencies: string[];
  amount: string;
  tiers: string[];
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
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      setSelectedCurrency(j.currency);
      setSelectedTier(j.amount);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountLabel = useMemo(() => {
    if (!cfg) return "$—";
    const c = selectedCurrency || cfg.currency;
    const a = selectedTier || cfg.amount;
    return formatMoney(c, a);
  }, [cfg, selectedCurrency, selectedTier]);

  const activeCurrency = useMemo(() => {
    if (!cfg) return null;
    const c = (selectedCurrency || cfg.currency || "").trim().toUpperCase();
    return cfg.allowedCurrencies.includes(c) ? c : cfg.currency;
  }, [cfg, selectedCurrency]);

  const activeTier = useMemo(() => {
    if (!cfg) return null;
    const a = String(selectedTier || cfg.amount || "").trim();
    return cfg.tiers.includes(a) ? a : cfg.amount;
  }, [cfg, selectedTier]);

  const paypalOptions = useMemo((): PayPalScriptOptions | null => {
    if (!cfg?.paypalClientId || !activeCurrency) return null;

    // SECURITY:
    // - It's OK to expose the PayPal *client id* in the browser.
    // - The PayPal *secret* never appears in client code; we only use it in server routes.
    // - The actual order amount/payee are enforced server-side, so "button hijacking" via client
    //   tampering cannot redirect funds or change the amount charged.
    return {
      clientId: cfg.paypalClientId,
      currency: activeCurrency,
      intent: "capture",
      components: "buttons,funding-eligibility",
      enableFunding: cfg.enableFunding ?? undefined,
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
          Donate {amountLabel}
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
            className="modal-panel w-full max-w-md cursor-default rounded-2xl border border-army-purple/20 bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="donation-modal-title" className="font-display text-xl font-bold text-army-purple">
              Confirm donation
            </h2>
            <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
              You are donating <strong>{amountLabel}</strong> to support the app. This is optional and securely
              processed via PayPal.
            </p>

            {cfg?.tiers?.length ? (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-army-purple" htmlFor="donation-tier">
                  Donation amount
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

            {cfg?.allowedCurrencies?.length ? (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-army-purple" htmlFor="donation-currency">
                  Currency
                </label>
                <select
                  id="donation-currency"
                  className="input-army mt-1"
                  value={activeCurrency ?? ""}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  disabled={submitting}
                >
                  {cfg.allowedCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  Currency is selectable, but only from an allowlist.
                </p>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-army-purple/15 bg-army-purple/5 p-4 text-sm text-neutral-700 dark:border-army-purple/25 dark:bg-army-purple/10 dark:text-neutral-300">
              <p className="font-semibold text-army-purple">Payment methods</p>
              <ul className="mt-2 list-disc pl-5 text-xs text-neutral-600 dark:text-neutral-400">
                <li>Pay with your PayPal account</li>
                <li>Pay with major credit/debit cards (no PayPal account required)</li>
                <li>Apple Pay / Google Pay may appear if your device/account is eligible</li>
              </ul>
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
            ) : (
              <div className="mt-4 space-y-3">
                {/* Changing currency requires reloading the PayPal JS SDK. */}
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
                        body: JSON.stringify({ currency: activeCurrency, amount: activeTier }),
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

                  {/* Card button (lets donors pay with card without a PayPal account when eligible) */}
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
                        body: JSON.stringify({ currency: activeCurrency, amount: activeTier }),
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

