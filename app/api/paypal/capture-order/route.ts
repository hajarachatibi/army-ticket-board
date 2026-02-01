import { captureAndVerifyDonationOrder, jsonNoStore } from "@/lib/paypal/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { orderId?: string } | null;
  const orderId = String(body?.orderId ?? "").trim();

  if (!orderId) {
    return jsonNoStore({ ok: false, error: "Missing orderId" }, { status: 400 });
  }

  try {
    const result = await captureAndVerifyDonationOrder(orderId);
    return jsonNoStore({ ok: true, orderId: result.orderId, captureId: result.captureId });
  } catch (err) {
    return jsonNoStore(
      { ok: false, error: err instanceof Error ? err.message : "Failed to capture order" },
      { status: 500 }
    );
  }
}

