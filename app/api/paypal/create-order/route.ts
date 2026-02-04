import { createDonationOrder, jsonNoStore } from "@/lib/paypal/server";

/** Donations are USD-only. Client must not pass a different currency. */
const ALLOWED_CURRENCY = "USD";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { currency?: string; amount?: string } | null;
  const amount = body?.amount != null ? String(body.amount).trim() : undefined;

  // Reject if client sends any currency other than USD (no override).
  if (body?.currency != null) {
    const requested = String(body.currency).trim().toUpperCase();
    if (requested !== ALLOWED_CURRENCY) {
      return jsonNoStore(
        { ok: false, error: "Only USD is accepted. Do not pass a different currency." },
        { status: 400 }
      );
    }
  }

  try {
    const { orderId } = await createDonationOrder({ amount });
    return jsonNoStore({ ok: true, orderId });
  } catch (err) {
    return jsonNoStore(
      { ok: false, error: err instanceof Error ? err.message : "Failed to create order" },
      { status: 500 }
    );
  }
}

