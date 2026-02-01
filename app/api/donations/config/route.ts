import { getDonationConfig, jsonNoStore } from "@/lib/paypal/server";

export async function GET() {
  const cfg = getDonationConfig();

  // Only return non-sensitive config values.
  return jsonNoStore({
    ok: true,
    enabled: cfg.enabled,
    paypalClientId: cfg.paypalClientId,
    currency: cfg.currency,
    allowedCurrencies: cfg.allowedCurrencies,
    mode: cfg.mode,
    amount: cfg.amount,
    tiers: cfg.tiers,
    minAmount: cfg.minAmount,
    maxAmount: cfg.maxAmount,
    environment: cfg.environment,
    enableFunding: cfg.enableFunding,
  });
}

