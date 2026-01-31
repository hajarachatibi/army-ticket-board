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
  const { data, error } = await supabase
    .from("forum_questions")
    .select("id, prompt, kind, position, active")
    .eq("active", true)
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
  const { error } = await supabase.from("forum_submissions").insert({
    user_id: params.userId,
    answers: params.answers,
  });
  return { error: error?.message ?? null };
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

export async function adminAddDynamicForumQuestion(params: {
  prompt: string;
  position?: number;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("forum_questions").insert({
    prompt: params.prompt,
    kind: "dynamic",
    position: params.position ?? 1000,
    active: true,
  });
  return { error: error?.message ?? null };
}

export async function adminSetForumQuestionActive(params: {
  id: string;
  active: boolean;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("forum_questions").update({ active: params.active }).eq("id", params.id);
  return { error: error?.message ?? null };
}

export async function adminDeleteForumQuestion(params: { id: string }): Promise<{ error: string | null }> {
  const { error } = await supabase.from("forum_questions").delete().eq("id", params.id);
  return { error: error?.message ?? null };
}

