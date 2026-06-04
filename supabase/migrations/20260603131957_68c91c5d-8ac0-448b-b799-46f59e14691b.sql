CREATE OR REPLACE FUNCTION public.get_quiz_student_result(p_session_id uuid, p_student_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s_status text;
  s_reveal boolean;
  s_questions jsonb;
  s_roster jsonb;
  trimmed_name text;
  answers_out jsonb;
  correct_count int := 0;
  objective_total int := 0;
  q jsonb;
  q_type text;
BEGIN
  IF p_student_name IS NULL OR trim(p_student_name) = '' THEN
    RETURN NULL;
  END IF;
  trimmed_name := trim(p_student_name);

  SELECT status, reveal_answers, questions, student_names
    INTO s_status, s_reveal, s_questions, s_roster
  FROM quiz_sessions WHERE id = p_session_id;

  IF s_status IS NULL THEN RETURN NULL; END IF;
  IF s_status <> 'ended' OR COALESCE(s_reveal, false) <> true THEN
    RETURN NULL;
  END IF;

  -- Enforce roster: when teacher configured a student name list, only those
  -- names can read their result. Prevents enumeration / impersonation of
  -- other students' scores via guessing names.
  IF s_roster IS NOT NULL
     AND jsonb_typeof(s_roster) = 'array'
     AND jsonb_array_length(s_roster) > 0
     AND NOT (s_roster @> to_jsonb(trimmed_name)) THEN
    RETURN NULL;
  END IF;

  -- Only return a result for students who actually submitted answers,
  -- so guessers cannot probe whether a given name exists.
  IF NOT EXISTS (
    SELECT 1 FROM quiz_answers
    WHERE session_id = p_session_id AND student_name = trimmed_name
  ) THEN
    RETURN NULL;
  END IF;

  FOR q IN SELECT * FROM jsonb_array_elements(s_questions) LOOP
    q_type := q->>'type';
    IF q_type IN ('single', 'multi', 'tf') THEN
      objective_total := objective_total + 1;
    END IF;
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
    AND student_name = trimmed_name;

  RETURN jsonb_build_object(
    'student_name', trimmed_name,
    'answers', COALESCE(answers_out, '[]'::jsonb),
    'correct_count', COALESCE(correct_count, 0),
    'objective_total', objective_total
  );
END;
$function$;