import { NextResponse } from "next/server";

export type DonationConfig = {
  enabled: boolean;
  paypalClientId: string | null; // safe to expose to client
  currency: string; // default currency
  allowedCurrencies: string[]; // server-controlled allowlist
  mode: "tiers" | "custom";
  amount: string; // default amount, e.g. "5.00"
  tiers: string[]; // allowlisted tier amounts (used only in tiers mode)
  minAmount: string; // used only in custom mode
  maxAmount: string; // used only in custom mode
  environment: "sandbox" | "live";
  // Optional: if set, we lock the payee to this merchant id.
  merchantId: string | null;
  // Optional wallet funding sources (availability depends on country/device/account eligibility).
  enableFunding: string | null; // e.g. "venmo,paylater"
};

function normalizeEnv(value: string | undefined): "sandbox" | "live" {
  const v = String(value ?? "sandbox").trim().toLowerCase();
  return v === "live" || v === "production" ? "live" : "sandbox";
}

function normalizeDonationMode(value: string | undefined): "tiers" | "custom" | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "tiers") return "tiers";
  if (v === "custom") return "custom";
  return null;
}

function normalizeEnableFunding(value: string | undefined): string | null {
  // IMPORTANT:
  // PayPal's `enable-funding` is for PayPal funding sources (e.g. venmo, paylater).
  // Apple Pay / Google Pay are NOT enabled via `enable-funding` in the standard Smart Buttons flow
  // and passing them here can cause the PayPal JS SDK script to fail to load.
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const allowed = new Set(["venmo", "paylater"]);
  const items = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => allowed.has(s));

  return items.length ? items.join(",") : null;
}

export function getDonationConfig(): DonationConfig {
  const environment = normalizeEnv(process.env.PAYPAL_ENV);

  const paypalClientId =
    (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "").trim() || null;

  const currency = (process.env.DONATION_CURRENCY || "USD").trim().toUpperCase() || "USD";
  const amount = (process.env.DONATION_AMOUNT || "5.00").trim();
  const allowedCurrencies = String(process.env.DONATION_ALLOWED_CURRENCIES || currency)
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const tiers = String(process.env.DONATION_TIERS || amount)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const minAmount = (process.env.DONATION_MIN_AMOUNT || "1.00").trim();
  const maxAmount = (process.env.DONATION_MAX_AMOUNT || "500.00").trim();

  const explicitMode = normalizeDonationMode(process.env.DONATION_MODE);
  const mode: "tiers" | "custom" = explicitMode ?? (process.env.DONATION_TIERS ? "tiers" : "custom");

  // Extra safety: when set, we explicitly set/verify the payee merchant id.
  const merchantId = (process.env.PAYPAL_MERCHANT_ID || "").trim() || null;

  // Optional wallets. Must also be enabled in your PayPal account (and only works where eligible).
  const enableFunding = normalizeEnableFunding(process.env.NEXT_PUBLIC_PAYPAL_ENABLE_FUNDING);

  // Donations are "enabled" only when server credentials exist.
  const hasSecret = !!(process.env.PAYPAL_CLIENT_SECRET || "").trim();
  const enabled = !!paypalClientId && hasSecret;

  return {
    enabled,
    paypalClientId,
    currency,
    allowedCurrencies,
    mode,
    amount,
    tiers,
    minAmount,
    maxAmount,
    environment,
    merchantId,
    enableFunding,
  };
}

export function getPayPalBaseUrl(environment: "sandbox" | "live") {
  return environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken() {
  const clientId =
    (process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "").trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured (missing client id/secret).");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const environment = normalizeEnv(process.env.PAYPAL_ENV);
  const baseUrl = getPayPalBaseUrl(environment);

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const j = (await res.json().catch(() => null)) as { access_token?: string; error?: unknown } | null;
  if (!res.ok || !j?.access_token) {
    throw new Error(`Failed to obtain PayPal access token (HTTP ${res.status}).`);
  }
  return { accessToken: j.access_token, baseUrl };
}

function isAllowedCurrency(currency: string, allowedCurrencies: string[]) {
  return allowedCurrencies.includes(currency);
}

function isAllowedTierAmount(value: string, tiers: string[]) {
  // Keep this lenient and let PayPal validate currency-specific decimal rules.
  // We only enforce the allowlist (prevents arbitrary amounts).
  return tiers.includes(value);
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  // Common “no-decimal” currencies.
  // If you add such currencies to your allowlist, donors must enter whole numbers.
  "JPY",
  "KRW",
  "VND",
  "CLP",
  "PYG",
]);

function parseMoneyLike(value: string) {
  const raw = String(value ?? "").trim();
  // Accept "12", "12.3", "12.34"
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function formatAmountForCurrency(amount: number, currency: string) {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
    if (!Number.isInteger(amount)) throw new Error("This currency requires a whole-number amount.");
    return String(amount);
  }
  return amount.toFixed(2);
}

export async function createDonationOrder(opts?: { currency?: string; amount?: string }) {
  const config = getDonationConfig();
  if (!config.enabled) throw new Error("Donations are not enabled.");

  // SECURITY:
  // - Amount is selectable by the user, but enforced server-side:
  //   - either from preset tiers, OR
  //   - as a custom amount within server-defined min/max bounds.
  // - Currency is selectable by the user, but ONLY from a server-controlled allowlist.
  const currency = String(opts?.currency ?? config.currency).trim().toUpperCase();
  if (!isAllowedCurrency(currency, config.allowedCurrencies)) {
    throw new Error("Unsupported currency.");
  }

  let amount: string;
  if (config.mode === "tiers") {
    const requested = String(opts?.amount ?? config.amount).trim();
    if (!isAllowedTierAmount(requested, config.tiers)) {
      throw new Error("Unsupported donation amount.");
    }
    amount = requested;
  } else {
    const min = parseMoneyLike(config.minAmount);
    const max = parseMoneyLike(config.maxAmount);
    if (min == null || max == null || min <= 0 || max <= 0 || min > max) {
      throw new Error("Donation min/max configuration is invalid.");
    }
    const requestedRaw = String(opts?.amount ?? config.amount).trim();
    const requested = parseMoneyLike(requestedRaw);
    if (requested == null) throw new Error("Invalid donation amount.");
    if (requested < min) throw new Error(`Minimum donation is ${formatAmountForCurrency(min, currency)} ${currency}.`);
    if (requested > max) throw new Error(`Maximum donation is ${formatAmountForCurrency(max, currency)} ${currency}.`);
    amount = formatAmountForCurrency(requested, currency);
  }

  const { accessToken, baseUrl } = await getPayPalAccessToken();

  // SECURITY:
  // - We do NOT accept amount/payee from the browser.
  // - Even if an attacker tampers with the client, the order created here still targets YOUR account
  //   (and optionally the specific merchant id), for the server-configured amount only.
  const body: any = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: { currency_code: currency, value: amount },
        description: "Donation",
      },
    ],
    application_context: {
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
    },
  };

  if (config.merchantId) {
    body.purchase_units[0].payee = { merchant_id: config.merchantId };
  }

  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const j = (await res.json().catch(() => null)) as any;
  if (!res.ok || !j?.id) {
    // PayPal typically returns: { name, message, details: [{ issue, description }], debug_id }
    const name = typeof j?.name === "string" ? j.name : null;
    const message = typeof j?.message === "string" ? j.message : null;
    const debugId = typeof j?.debug_id === "string" ? j.debug_id : null;
    const firstDetail = Array.isArray(j?.details) ? j.details[0] : null;
    const issue = typeof firstDetail?.issue === "string" ? firstDetail.issue : null;
    const description = typeof firstDetail?.description === "string" ? firstDetail.description : null;

    const parts = [
      `Failed to create PayPal order (HTTP ${res.status}).`,
      name ? `name=${name}` : null,
      issue ? `issue=${issue}` : null,
      message ? `message=${message}` : null,
      description ? `detail=${description}` : null,
      debugId ? `debug_id=${debugId}` : null,
      config.merchantId
        ? "Hint: if you set PAYPAL_MERCHANT_ID, it must match the *sandbox* business merchant id when PAYPAL_ENV=sandbox."
        : null,
    ].filter(Boolean);

    // Log full payload for local debugging (avoid in production logs).
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("PayPal create order error payload:", j);
    }

    throw new Error(parts.join(" "));
  }

  return { orderId: j.id, currency, amount };
}

export async function captureAndVerifyDonationOrder(orderId: string) {
  const config = getDonationConfig();
  if (!config.enabled) throw new Error("Donations are not enabled.");

  const { accessToken, baseUrl } = await getPayPalAccessToken();

  const res = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const j = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const name = typeof j?.name === "string" ? j.name : null;
    const message = typeof j?.message === "string" ? j.message : null;
    const debugId = typeof j?.debug_id === "string" ? j.debug_id : null;
    const firstDetail = Array.isArray(j?.details) ? j.details[0] : null;
    const issue = typeof firstDetail?.issue === "string" ? firstDetail.issue : null;
    const description = typeof firstDetail?.description === "string" ? firstDetail.description : null;

    const parts = [
      `PayPal capture failed (HTTP ${res.status}).`,
      name ? `name=${name}` : null,
      issue ? `issue=${issue}` : null,
      message ? `message=${message}` : null,
      description ? `detail=${description}` : null,
      debugId ? `debug_id=${debugId}` : null,
    ].filter(Boolean);

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("PayPal capture error payload:", j);
    }

    throw new Error(parts.join(" "));
  }

  // Minimal verification: ensure the order completed and matches server-configured donation amount.
  const status = String(j?.status ?? "");
  if (status !== "COMPLETED") {
    throw new Error(`Order not completed (status=${status || "unknown"}).`);
  }

  const pu = j?.purchase_units?.[0];
  const amount = pu?.amount;
  const currency = String(amount?.currency_code ?? "");
  const value = String(amount?.value ?? "");
  if (!isAllowedCurrency(currency, config.allowedCurrencies)) {
    throw new Error("Captured amount does not match expected donation amount.");
  }
  if (config.mode === "tiers") {
    if (!isAllowedTierAmount(value, config.tiers)) {
      throw new Error("Captured amount does not match expected donation amount.");
    }
  } else {
    const min = parseMoneyLike(config.minAmount);
    const max = parseMoneyLike(config.maxAmount);
    const captured = parseMoneyLike(value);
    if (min == null || max == null || captured == null || captured < min || captured > max) {
      throw new Error("Captured amount does not match expected donation amount.");
    }
  }

  if (config.merchantId) {
    const payeeMerchantId = String(pu?.payee?.merchant_id ?? "");
    if (payeeMerchantId && payeeMerchantId !== config.merchantId) {
      throw new Error("Captured payee does not match expected merchant.");
    }
  }

  const captureId =
    j?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
    j?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id ||
    null;

  return { orderId, captureId, raw: j };
}

export function jsonNoStore(data: unknown, init?: { status?: number }) {
  const res = NextResponse.json(data, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

