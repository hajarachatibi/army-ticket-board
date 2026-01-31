import { supabase } from "@/lib/supabaseClient";

const BUCKET = "proof-attachments";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mime] ?? "jpg";
}

export async function uploadUserReportImage(params: {
  userId: string;
  file: File;
}): Promise<{ path: string } | { error: string }> {
  const file = params.file;
  if (!ALLOWED.includes(file.type)) {
    return { error: "Only JPEG, PNG, GIF, and WebP images are allowed." };
  }
  if (file.size > MAX_SIZE) {
    return { error: "Image must be 5MB or smaller." };
  }

  const ext = extFromMime(file.type);
  const path = `user-reports/${params.userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { error: error.message };
  return { path };
}

