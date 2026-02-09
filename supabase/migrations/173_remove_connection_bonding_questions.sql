-- Remove connection_bonding_questions; it is no longer used.
-- Bonding questions are drawn from bonding_questions (random 2 per user); answers and
-- question_ids are stored in user_bonding_answers. Lite profiles
-- map prompts from bonding_questions to answers per user.

DROP POLICY IF EXISTS "connection_bonding_questions_select" ON public.connection_bonding_questions;
DROP POLICY IF EXISTS "connection_bonding_questions_admin" ON public.connection_bonding_questions;
DROP TABLE IF EXISTS public.connection_bonding_questions;
