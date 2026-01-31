import { supabase } from "@/lib/supabaseClient";

export type SellerProofStatus = { hasApproved: boolean; latestStatus: "pending" | "approved" | "rejected" | null };

export async function fetchMySellerProofStatus(): Promise<{ data: SellerProofStatus; error: string | null }> {
  const { data, error } = await supabase.rpc("my_seller_proof_status");
  if (error) return { data: { hasApproved: false, latestStatus: null }, error: error.message };
  const d = (data ?? {}) as any;
  return {
    data: {
      hasApproved: Boolean(d.has_approved),
      latestStatus: (typeof d.latest_status === "string" ? d.latest_status : null) as SellerProofStatus["latestStatus"],
    },
    error: null,
  };
}

export async function submitSellerProof(params: {
  userId: string;
  fullName: string;
  country: string;
  platform: string;
  proofDetails: string;
  screenshotUrl: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("seller_proof_applications").insert({
    user_id: params.userId,
    full_name: params.fullName,
    country: params.country,
    platform: params.platform,
    proof_details: params.proofDetails,
    screenshot_url: params.screenshotUrl,
    status: "pending",
  });
  return { error: error?.message ?? null };
}

export type SellerProofApplication = {
  id: string;
  userId: string;
  fullName: string;
  country: string;
  platform: string;
  proofDetails: string;
  screenshotPath: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  createdAt: string;
};

export async function adminFetchSellerProofApplications(): Promise<{ data: SellerProofApplication[]; error: string | null }> {
  const { data, error } = await supabase
    .from("seller_proof_applications")
    .select("id, user_id, full_name, country, platform, proof_details, screenshot_url, status, admin_note, created_at")
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      fullName: String(r.full_name ?? ""),
      country: String(r.country ?? ""),
      platform: String(r.platform ?? ""),
      proofDetails: String(r.proof_details ?? ""),
      screenshotPath: String(r.screenshot_url ?? ""),
      status: String(r.status ?? "pending") as SellerProofApplication["status"],
      adminNote: typeof r.admin_note === "string" ? r.admin_note : null,
      createdAt: String(r.created_at),
    })),
    error: null,
  };
}

export async function adminSetSellerProofStatus(params: {
  id: string;
  status: "approved" | "rejected";
  adminNote?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("seller_proof_applications")
    .update({ status: params.status, admin_note: params.adminNote ?? null })
    .eq("id", params.id);
  return { error: error?.message ?? null };
}

