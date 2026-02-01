import { supabase } from "@/lib/supabaseClient";

export type ForumQuestion = {
  id: string;
  prompt: string;
  kind: "static" | "dynamic";
  position: number;
  active: boolean;
};

export type ForumStatus = {
  submitted_at: string | null;
  latest_questions_at: string;
  needs_submit: boolean;
};

export async function fetchActiveForumQuestions(): Promise<{ data: ForumQuestion[] | null; error: string | null }> {
  // User form behavior:
  // - all active static questions
  // - + 3 random active dynamic questions
  const rpc = await supabase.rpc("get_forum_questions_for_user", { p_dynamic_count: 3 });
  if (!rpc.error) {
    return {
      data: (rpc.data ?? []).map((r: any) => ({
        id: String(r.id),
        prompt: String(r.prompt ?? ""),
        kind: (String(r.kind ?? "dynamic") as "static" | "dynamic"),
        position: Number(r.position ?? 0),
        active: Boolean(r.active),
      })),
      error: null,
    };
  }

  // Fallback for older DBs where the RPC isn't deployed yet.
  const { data, error } = await supabase
    .from("forum_questions")
    .select("id, prompt, kind, position, active, created_at")
    .eq("active", true);
  if (error) return { data: null, error: error.message };

  const rows = (data ?? []).map((r: any) => ({
    id: String(r.id),
    prompt: String(r.prompt ?? ""),
    kind: (String(r.kind ?? "dynamic") as "static" | "dynamic"),
    position: Number(r.position ?? 0),
    active: Boolean(r.active),
    createdAt: String((r as any).created_at ?? ""),
  }));

  const statics = rows
    .filter((r) => r.kind === "static")
    .sort((a, b) => (a.position - b.position) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  const dynamics = rows.filter((r) => r.kind === "dynamic");
  const chosen: typeof dynamics = [];
  const pool = [...dynamics];
  while (chosen.length < 3 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]!);
  }

  return { data: [...statics, ...chosen].map(({ createdAt: _c, ...q }) => q), error: null };
}

export async function fetchMyForumStatus(): Promise<{ data: ForumStatus | null; error: string | null }> {
  const { data, error } = await supabase.rpc("my_forum_status");
  if (error) return { data: null, error: error.message };
  const d = data as any;
  if (!d) return { data: null, error: null };
  return {
    data: {
      submitted_at: d.submitted_at ?? null,
      latest_questions_at: String(d.latest_questions_at ?? ""),
      needs_submit: Boolean(d.needs_submit),
    },
    error: null,
  };
}

export async function submitForumAnswers(params: {
  userId: string;
  answers: Record<string, string>;
}): Promise<{ error: string | null }> {
  // This client helper is intentionally unused after moving submissions
  // to a BotID-protected server route. Keep for backward compatibility.
  void params;
  return { error: "Forum submission is handled by the server." };
}

// Admin helpers (RLS-protected by is_admin()).
export async function adminFetchAllForumQuestions(): Promise<{ data: ForumQuestion[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("forum_questions")
    .select("id, prompt, kind, position, active")
    .order("active", { ascending: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { data: null, error: error.message };
  return {
    data: (data ?? []).map((r) => ({
      id: String(r.id),
      prompt: String(r.prompt ?? ""),
      kind: (String(r.kind ?? "dynamic") as "static" | "dynamic"),
      position: Number(r.position ?? 0),
      active: Boolean(r.active),
    })),
    error: null,
  };
}

export async function adminAddForumQuestion(params: {
  prompt: string;
  kind?: "static" | "dynamic";
  active?: boolean;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("forum_questions").insert({
    prompt: params.prompt,
    kind: params.kind ?? "dynamic",
    // Admin UI no longer exposes "position"; keep new questions after defaults.
    position: 1000,
    active: params.active ?? true,
  });
  return { error: error?.message ?? null };
}

// Backward compatible wrapper.
export async function adminAddDynamicForumQuestion(params: {
  prompt: string;
}): Promise<{ error: string | null }> {
  return adminAddForumQuestion({ prompt: params.prompt, kind: "dynamic" });
}

export async function adminSetForumQuestionActive(params: {
  id: string;
  active: boolean;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("forum_questions").update({ active: params.active }).eq("id", params.id);
  return { error: error?.message ?? null };
}

export async function adminUpdateForumQuestion(params: {
  id: string;
  prompt?: string;
  kind?: "static" | "dynamic";
}): Promise<{ error: string | null }> {
  const update: Record<string, any> = {};
  if (params.prompt != null) update.prompt = params.prompt;
  if (params.kind != null) update.kind = params.kind;
  const { error } = await supabase.from("forum_questions").update(update).eq("id", params.id);
  return { error: error?.message ?? null };
}

export async function adminDeleteForumQuestion(params: { id: string }): Promise<{ error: string | null }> {
  const { error } = await supabase.from("forum_questions").delete().eq("id", params.id);
  return { error: error?.message ?? null };
}

export type AdminForumSubmission = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  answers: Record<string, string>;
  submittedAt: string;
};

export async function adminFetchForumSubmissions(): Promise<{ data: AdminForumSubmission[]; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_forum_submissions_with_details");
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as any[];
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      userEmail: r.user_email != null ? String(r.user_email) : null,
      username: r.username != null ? String(r.username) : null,
      answers: (r.answers ?? {}) as Record<string, string>,
      submittedAt: String(r.submitted_at),
    })),
    error: null,
  };
}

