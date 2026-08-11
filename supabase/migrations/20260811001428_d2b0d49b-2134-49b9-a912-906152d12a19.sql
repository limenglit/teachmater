ALTER TABLE public.quiz_sessions ADD COLUMN IF NOT EXISTS guest_names jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.get_quiz_session_for_student(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  questions_out jsonb;
  s_status text;
  s_reveal boolean;
BEGIN
  SELECT status, reveal_answers INTO s_status, s_reveal
  FROM quiz_sessions WHERE id = p_session_id;

  IF s_status IS NULL THEN
    RETURN NULL;
  END IF;

  IF s_status = 'ended' AND COALESCE(s_reveal, false) = true THEN
    SELECT jsonb_agg(q)
      INTO questions_out
    FROM quiz_sessions qs, jsonb_array_elements(qs.questions) AS q
    WHERE qs.id = p_session_id;
  ELSE
    SELECT jsonb_agg(q - 'correct_answer')
      INTO questions_out
    FROM quiz_sessions qs, jsonb_array_elements(qs.questions) AS q
    WHERE qs.id = p_session_id;
  END IF;

  SELECT jsonb_build_object(
    'id', qs.id,
    'title', qs.title,
    'status', qs.status,
    'reveal_answers', COALESCE(qs.reveal_answers, false),
    'student_names', qs.student_names,
    'guest_names', COALESCE(qs.guest_names, '[]'::jsonb),
    'questions', COALESCE(questions_out, '[]'::jsonb)
  )
  INTO result
  FROM quiz_sessions qs
  WHERE qs.id = p_session_id;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_quiz_answers(p_session_id uuid, p_student_name text, p_answers jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  session_record RECORD;
  q jsonb;
  i int;
  student_answer jsonb;
  correct jsonb;
  is_correct boolean;
  q_type text;
  trimmed_name text;
  is_guest boolean := false;
BEGIN
  SELECT * INTO session_record FROM quiz_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF session_record.status <> 'active' THEN RAISE EXCEPTION 'Session is not active'; END IF;
  IF p_student_name IS NULL OR trim(p_student_name) = '' THEN
    RAISE EXCEPTION 'Student name is required';
  END IF;
  trimmed_name := trim(p_student_name);
  IF char_length(trimmed_name) > 40 THEN
    RAISE EXCEPTION 'Student name is too long';
  END IF;

  -- Non-roster participants are admitted as temporary guests instead of being
  -- rejected: their name is appended to the session roster and flagged.
  IF session_record.student_names IS NOT NULL
     AND jsonb_typeof(session_record.student_names) = 'array'
     AND jsonb_array_length(session_record.student_names) > 0
     AND NOT (session_record.student_names @> to_jsonb(trimmed_name)) THEN
    is_guest := true;
  END IF;

  IF EXISTS (SELECT 1 FROM quiz_answers WHERE session_id = p_session_id AND student_name = trimmed_name) THEN
    RAISE EXCEPTION 'Already submitted';
  END IF;

  IF is_guest THEN
    UPDATE quiz_sessions
    SET student_names = COALESCE(student_names, '[]'::jsonb) || to_jsonb(trimmed_name),
        guest_names = CASE
          WHEN COALESCE(guest_names, '[]'::jsonb) @> to_jsonb(trimmed_name) THEN guest_names
          ELSE COALESCE(guest_names, '[]'::jsonb) || to_jsonb(trimmed_name)
        END
    WHERE id = p_session_id;
  END IF;

  i := 0;
  FOR q IN SELECT * FROM jsonb_array_elements(session_record.questions)
  LOOP
    student_answer := p_answers->i;
    correct := q->'correct_answer';
    q_type := q->>'type';
    is_correct := NULL;

    IF q_type IN ('single', 'tf') THEN
      is_correct := (student_answer = correct);
    ELSIF q_type = 'multi' THEN
      is_correct := (
        (SELECT jsonb_agg(v ORDER BY v) FROM jsonb_array_elements_text(COALESCE(student_answer, '[]'::jsonb)) v) =
        (SELECT jsonb_agg(v ORDER BY v) FROM jsonb_array_elements_text(COALESCE(correct, '[]'::jsonb)) v)
      );
    END IF;

    INSERT INTO quiz_answers (session_id, student_name, question_index, answer, is_correct)
    VALUES (p_session_id, trimmed_name, i, COALESCE(student_answer, '""'::jsonb), is_correct);

    i := i + 1;
  END LOOP;
END;
$function$;