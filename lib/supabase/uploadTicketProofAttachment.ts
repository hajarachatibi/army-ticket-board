import { supabase } from "@/lib/supabaseClient";

const BUCKET = "proof-attachments";

const IMAGE_ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];

const IMAGE_MAX = 8 * 1024 * 1024; // 8MB
const VIDEO_MAX = 80 * 1024 * 1024; // 80MB

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[mime] ?? "bin";
}

export type TicketProofKind = "tm_ticket_page" | "tm_screen_recording" | "tm_email_screenshot";

export async function uploadTicketProofAttachment(params: {
  userId: string;
  groupId: string;
  kind: TicketProofKind;
  file: File;
}): Promise<{ path: string } | { error: string }> {
  const { userId, groupId, kind } = params;
  const file = params.file;
  const isImage = IMAGE_ALLOWED.includes(file.type);
  const isVideo = VIDEO_ALLOWED.includes(file.type);

  if (!isImage && !isVideo) {
    return { error: "Unsupported file type. Please upload an image (JPG/PNG/WebP) or a video (MP4/WebM/MOV)." };
  }

  if (isImage && file.size > IMAGE_MAX) return { error: "Image must be 8MB or smaller." };
  if (isVideo && file.size > VIDEO_MAX) return { error: "Video must be 80MB or smaller." };

  const ext = extFromMime(file.type);
  const safeGroup = String(groupId || "").trim() || crypto.randomUUID();
  const path = `ticket-proofs/${userId}/${safeGroup}/${kind}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { error: error.message };
  return { path };
}

