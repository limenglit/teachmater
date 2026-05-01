-- 1. Add reveal_answers column to quiz_sessions
ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS reveal_answers boolean NOT NULL DEFAULT true;

-- 2. Recreate get_quiz_session_for_student so it returns reveal_answers, and includes
--    correct_answer only when the session has ended AND reveal_answers is true.
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
    -- Include correct_answer for the post-quiz answer reveal
    SELECT jsonb_agg(q)
      INTO questions_out
    FROM quiz_sessions qs, jsonb_array_elements(qs.questions) AS q
    WHERE qs.id = p_session_id;
  ELSE
    -- Strip correct_answer to keep it hidden during active session
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
    'questions', COALESCE(questions_out, '[]'::jsonb)
  )
  INTO result
  FROM quiz_sessions qs
  WHERE qs.id = p_session_id;

  RETURN result;
END;
$function$;

-- 3. Extend update_quiz_session to support setting reveal_answers
CREATE OR REPLACE FUNCTION public.update_quiz_session(
  p_session_id uuid,
  p_token text,
  p_status text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_reveal_answers boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM quiz_sessions WHERE id = p_session_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE quiz_sessions SET
    status = COALESCE(p_status, status),
    title = COALESCE(p_title, title),
    reveal_answers = COALESCE(p_reveal_answers, reveal_answers),
    ended_at = CASE WHEN p_status = 'ended' THEN now() ELSE ended_at END
  WHERE id = p_session_id AND creator_token = p_token;
END;
$function$;

-- 4. New RPC: return a student's own answers + correctness for an ended, revealed session
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
BEGIN
  IF p_student_name IS NULL OR trim(p_student_name) = '' THEN
    RETURN NULL;
  END IF;

  SELECT status, reveal_answers, questions
    INTO s_status, s_reveal, s_questions
  FROM quiz_sessions WHERE id = p_session_id;

  IF s_status IS NULL THEN RETURN NULL; END IF;
  IF s_status <> 'ended' OR COALESCE(s_reveal, false) <> true THEN
    RETURN NULL;
  END IF;

  -- Count objective questions for the score denominator
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
    AND student_name = trim(p_student_name);

  RETURN jsonb_build_object(
    'student_name', trim(p_student_name),
    'answers', COALESCE(answers_out, '[]'::jsonb),
    'correct_count', COALESCE(correct_count, 0),
    'objective_total', objective_total
  );
END;
$function$;