import { supabase } from "@/lib/supabaseClient";

export type UserQuestion = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  authorLabel: string;
};

export type UserQuestionReply = {
  id: string;
  questionId: string;
  userId: string;
  text: string;
  createdAt: string;
  displayLabel: string;
  role: string;
};

export async function fetchUserQuestions(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ data: UserQuestion[]; error: string | null }> {
  const { data, error } = await supabase.rpc("fetch_user_questions", {
    p_limit: params?.limit ?? 50,
    p_offset: params?.offset ?? 0,
  });
  if (error) return { data: [], error: error.message };
  const rows = ((data as { data?: unknown[] })?.data ?? []) as Array<{
    id: string;
    user_id: string;
    text: string;
    created_at: string;
    author_label: string;
  }>;
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      text: String(r.text ?? ""),
      createdAt: String(r.created_at),
      authorLabel: String(r.author_label ?? "User"),
    })),
    error: null,
  };
}

export async function createUserQuestion(params: {
  userId: string;
  text: string;
  anonymous?: boolean;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("user_questions").insert({
    user_id: params.userId,
    text: params.text,
    anonymous: params.anonymous !== false,
  });
  return { error: error?.message ?? null };
}

export async function fetchUserQuestionReplies(questionId: string): Promise<{
  data: UserQuestionReply[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("get_user_question_replies", { p_question_id: questionId });
  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as Array<{
    id: string;
    question_id: string;
    user_id: string;
    text: string;
    created_at: string;
    display_label: string;
    role: string;
  }>;
  return {
    data: rows.map((r) => ({
      id: String(r.id),
      questionId: String(r.question_id),
      userId: String(r.user_id),
      text: String(r.text ?? ""),
      createdAt: String(r.created_at),
      displayLabel: String(r.display_label ?? "Admin"),
      role: String(r.role ?? "user"),
    })),
    error: null,
  };
}

export async function addUserQuestionReply(params: {
  questionId: string;
  userId: string;
  text: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("user_question_replies").insert({
    question_id: params.questionId,
    user_id: params.userId,
    text: params.text,
  });
  return { error: error?.message ?? null };
}
