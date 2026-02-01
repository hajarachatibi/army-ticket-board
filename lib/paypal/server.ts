import { NextResponse } from "next/server";

export type DonationConfig = {
  enabled: boolean;
  paypalClientId: string | null; // safe to expose to client
  currency: string; // default currency
  allowedCurrencies: string[]; // server-controlled allowlist
  amount: string; // default tier amount, e.g. "5.00"
  tiers: string[]; // allowlisted tier amounts, e.g. ["5.00","10.00","25.00"]
  environment: "sandbox" | "live";
  // Optional: if set, we lock the payee to this merchant id.
  merchantId: string | null;
  // Optional wallet funding sources (availability depends on country/device/account eligibility).
  enableFunding: string | null; // e.g. "applepay,googlepay"
};

function normalizeEnv(value: string | undefined): "sandbox" | "live" {
  const v = String(value ?? "sandbox").trim().toLowerCase();
  return v === "live" || v === "production" ? "live" : "sandbox";
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

  // Extra safety: when set, we explicitly set/verify the payee merchant id.
  const merchantId = (process.env.PAYPAL_MERCHANT_ID || "").trim() || null;

  // Optional wallets. Must also be enabled in your PayPal account (and only works where eligible).
  const enableFunding = (process.env.NEXT_PUBLIC_PAYPAL_ENABLE_FUNDING || "").trim() || null;

  // Donations are "enabled" only when server credentials exist.
  const hasSecret = !!(process.env.PAYPAL_CLIENT_SECRET || "").trim();
  const enabled = !!paypalClientId && hasSecret;

  return {
    enabled,
    paypalClientId,
    currency,
    allowedCurrencies,
    amount,
    tiers,
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

export async function createDonationOrder(opts?: { currency?: string; amount?: string }) {
  const config = getDonationConfig();
  if (!config.enabled) throw new Error("Donations are not enabled.");

  // SECURITY:
  // - Amount is fixed server-side (no "flexible amount" from the browser).
  // - Amount is selectable by the user, but ONLY from a server-controlled tier allowlist.
  // - Currency is selectable by the user, but ONLY from a server-controlled allowlist.
  const currency = String(opts?.currency ?? config.currency).trim().toUpperCase();
  if (!isAllowedCurrency(currency, config.allowedCurrencies)) {
    throw new Error("Unsupported currency.");
  }
  const amount = String(opts?.amount ?? config.amount).trim();
  if (!isAllowedTierAmount(amount, config.tiers)) {
    throw new Error("Unsupported donation amount.");
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

  const j = (await res.json().catch(() => null)) as { id?: string; status?: string; message?: string } | null;
  if (!res.ok || !j?.id) {
    throw new Error(`Failed to create PayPal order (HTTP ${res.status}).`);
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
    const msg = typeof j?.message === "string" ? j.message : `HTTP ${res.status}`;
    throw new Error(`PayPal capture failed: ${msg}`);
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
  if (!isAllowedCurrency(currency, config.allowedCurrencies) || !isAllowedTierAmount(value, config.tiers)) {
    throw new Error("Captured amount does not match expected donation amount.");
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

