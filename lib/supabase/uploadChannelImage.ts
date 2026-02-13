import { supabase } from "@/lib/supabaseClient";

const BUCKET = "chat-attachments";
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

export async function uploadChannelImage(
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED.includes(file.type)) {
    return { error: "Only JPEG, PNG, GIF, and WebP images are allowed." };
  }
  if (file.size > MAX_SIZE) {
    return { error: "Image must be 5MB or smaller." };
  }

  const ext = extFromMime(file.type);
  const path = `admin-channel/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { error: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Upload image for community chat (same bucket, path: community-chat/). */
export async function uploadCommunityChatImage(
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED.includes(file.type)) {
    return { error: "Only JPEG, PNG, GIF, and WebP images are allowed." };
  }
  if (file.size > MAX_SIZE) {
    return { error: "Image must be 5MB or smaller." };
  }

  const ext = extFromMime(file.type);
  const path = `community-chat/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { error: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Upload image for merch listing (same bucket, path: merch-listings/{userId}/). */
export async function uploadMerchListingImage(
  file: File,
  userId: string
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED.includes(file.type)) {
    return { error: "Only JPEG, PNG, GIF, and WebP images are allowed." };
  }
  if (file.size > MAX_SIZE) {
    return { error: "Image must be 5MB or smaller." };
  }

  const ext = extFromMime(file.type);
  const path = `merch-listings/${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { error: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

