import { createDonationOrder, jsonNoStore } from "@/lib/paypal/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { currency?: string; amount?: string } | null;
  const currency = body?.currency ? String(body.currency).trim().toUpperCase() : undefined;
  const amount = body?.amount ? String(body.amount).trim() : undefined;

  try {
    const { orderId } = await createDonationOrder({ currency, amount });
    return jsonNoStore({ ok: true, orderId });
  } catch (err) {
    return jsonNoStore(
      { ok: false, error: err instanceof Error ? err.message : "Failed to create order" },
      { status: 500 }
    );
  }
}

