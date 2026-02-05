-- Seed anonymous FAQ-style questions and admin replies.
-- Uses first user for question author and first admin for reply author.

DO $$
DECLARE
  v_author_id uuid;
  v_admin_id uuid;
  v_q_id uuid;
  v_questions text[] := ARRAY[
    'Any reason why after I fill out the Army Profile, it says Access Denied?',
    'Stage 2 says Finished but I don''t see anything else since yesterday. No progress to "preview". Is there something missing?',
    'How do I change the post to available?',
    'What happens after request to connect?',
    'If a city is missing in the filter, is it because no one has posted a listing for that city?',
    'I''ve made a connection but how do I find them on social media?',
    'What does it mean that it was locked? Does that mean those tickets have a buyer? 🥺',
    'If when you connect and wait to see if the seller accepts you, while they accept, can others still connect with the seller?',
    'I tried to use the filter and noticed Toronto was not an option in the dropdown box. Can people list tickets for sale for Toronto?'
  ];
  v_answers text[] := ARRAY[
    'The page may have been open for a long time and your session expired. Please refresh the page and try again. If you''re using any script-blocking extensions, please disable them for this site. After logging in again, complete the setup form that appears—do not refresh or skip it. Submit your answers to proceed.',
    'In that case, it means the seller still needs to complete stage 2. Once that''s done, you can proceed to the preview stage. If the connection status is set to Ended, it means it expired because the seller was inactive, the seller chose to end it, or the listing was identified as fake and removed by the admins.',
    'You can do that by clicking on: end/release connection. Go to Listings → My connections → open the connection → click release/end.',
    'The seller gets the request notification; they can either accept or decline. If accepted, the buyer and the seller will go through some steps together until they get to share their socials if they agree.',
    'Yes!',
    'If the seller accepts your connection, you will go through some steps until you two exchange your socials. Good luck 💜',
    'Yes, if it''s locked it means there is a potential buyer and the seller accepted them. If they don''t agree somehow, the seller can end the connection and the ticket will be unlocked again. Good luck 💜',
    'A seller can only accept one buyer at a time. The other buyers will be on the waiting list. If the ticket gets sold, the connections will end automatically.',
    'If a city is not in the filter dropdown box, it means that no one has posted a ticket for that city. Once a ticket has been added, the city will be automatically added to the city filter.'
  ];
  i int;
BEGIN
  SELECT id INTO v_author_id FROM public.user_profiles ORDER BY created_at LIMIT 1;
  SELECT id INTO v_admin_id FROM public.user_profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_author_id IS NULL OR v_admin_id IS NULL THEN
    RETURN;
  END IF;

  FOR i IN 1..array_length(v_questions, 1) LOOP
    INSERT INTO public.user_questions (user_id, text, anonymous)
    VALUES (v_author_id, v_questions[i], true)
    RETURNING id INTO v_q_id;

    INSERT INTO public.user_question_replies (question_id, user_id, text)
    VALUES (v_q_id, v_admin_id, v_answers[i]);
  END LOOP;
END $$;
