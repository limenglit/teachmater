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
  normalized_name text;
BEGIN
  SELECT * INTO session_record FROM quiz_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF session_record.status <> 'active' THEN RAISE EXCEPTION 'Session is not active'; END IF;
  IF p_student_name IS NULL OR trim(p_student_name) = '' THEN
    RAISE EXCEPTION 'Student name is required';
  END IF;

  normalized_name := regexp_replace(replace(trim(p_student_name), '　', ' '), '\s+', ' ', 'g');

  IF session_record.student_names IS NOT NULL
     AND jsonb_typeof(session_record.student_names) = 'array'
     AND jsonb_array_length(session_record.student_names) > 0
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements_text(session_record.student_names) AS roster_name(value)
       WHERE regexp_replace(replace(trim(roster_name.value), '　', ' '), '\s+', ' ', 'g') = normalized_name
     ) THEN
    RAISE EXCEPTION 'Student name not found in session roster';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM quiz_answers
    WHERE session_id = p_session_id
      AND regexp_replace(replace(trim(student_name), '　', ' '), '\s+', ' ', 'g') = normalized_name
  ) THEN
    RAISE EXCEPTION 'Already submitted';
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
    VALUES (p_session_id, normalized_name, i, COALESCE(student_answer, '""'::jsonb), is_correct);

    i := i + 1;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_quiz_student_result(
  p_session_id uuid,
  p_student_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s_status text;
  s_reveal boolean;
  s_questions jsonb;
  answers_out jsonb;
  correct_count int := 0;
  objective_total int := 0;
  q jsonb;
  i int := 0;
  q_type text;
  normalized_name text;
BEGIN
  normalized_name := regexp_replace(replace(trim(COALESCE(p_student_name, '')), '　', ' '), '\s+', ' ', 'g');
  IF normalized_name = '' THEN
    RETURN NULL;
  END IF;

  SELECT status, reveal_answers, questions
    INTO s_status, s_reveal, s_questions
  FROM quiz_sessions WHERE id = p_session_id;

  IF s_status IS NULL THEN RETURN NULL; END IF;
  IF s_status <> 'ended' OR COALESCE(s_reveal, false) <> true THEN
    RETURN NULL;
  END IF;

  FOR q IN SELECT * FROM jsonb_array_elements(s_questions) LOOP
    q_type := q->>'type';
    IF q_type IN ('single', 'multi', 'tf') THEN
      objective_total := objective_total + 1;
    END IF;
    i := i + 1;
  END LOOP;

  SELECT jsonb_agg(jsonb_build_object(
           'question_index', question_index,
           'answer', answer,
           'is_correct', is_correct
         ) ORDER BY question_index),
         COUNT(*) FILTER (WHERE is_correct IS TRUE)
    INTO answers_out, correct_count
  FROM quiz_answers
  WHERE session_id = p_session_id
    AND regexp_replace(replace(trim(student_name), '　', ' '), '\s+', ' ', 'g') = normalized_name;

  RETURN jsonb_build_object(
    'student_name', normalized_name,
    'answers', COALESCE(answers_out, '[]'::jsonb),
    'correct_count', COALESCE(correct_count, 0),
    'objective_total', objective_total
  );
END;
$function$;