-- Ensure a default set of BTS questions exists (idempotent).
-- Inserts only when there are no active questions.

INSERT INTO public.forum_questions (prompt, kind, position, active)
SELECT v.prompt, v.kind, v.position, true
FROM (
  VALUES
    ('Who is the leader of BTS?', 'static', 10),
    ('What does ARMY stand for?', 'static', 20),
    ('Name any 2 BTS members.', 'static', 30),
    ('What year did BTS debut?', 'static', 40),
    ('What is your favorite BTS song and why?', 'static', 50)
) AS v(prompt, kind, position)
WHERE NOT EXISTS (SELECT 1 FROM public.forum_questions q WHERE q.active = true);

