-- Ensure reveal_answers column/RPC behavior exists and provide a student-result RPC.
ALTER TABLE public.quiz_sessions
ADD COLUMN IF NOT EXISTS reveal_answers boolean NOT NULL DEFAULT false;

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
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM quiz_sessions WHERE id = p_session_id AND creator_token = p_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE quiz_sessions
  SET
    status = COALESCE(p_status, status),
    title = COALESCE(p_title, title),
    reveal_answers = COALESCE(p_reveal_answers, reveal_answers),
    ended_at = CASE WHEN p_status = 'ended' THEN now() ELSE ended_at END
  WHERE id = p_session_id AND creator_token = p_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quiz_session_for_student(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  qs_record RECORD;
  question_payload jsonb;
BEGIN
  SELECT * INTO qs_record FROM quiz_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF qs_record.status = 'ended' AND COALESCE(qs_record.reveal_answers, false) THEN
    question_payload := qs_record.questions;
  ELSE
    SELECT jsonb_agg(q - 'correct_answer')
    INTO question_payload
    FROM jsonb_array_elements(qs_record.questions) AS q;
  END IF;

  result := jsonb_build_object(
    'id', qs_record.id,
    'title', qs_record.title,
    'status', qs_record.status,
    'reveal_answers', COALESCE(qs_record.reveal_answers, false),
    'student_names', qs_record.student_names,
    'questions', COALESCE(question_payload, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

-- Return one student's answer card after quiz ended and answers are revealed.
CREATE OR REPLACE FUNCTION public.get_quiz_student_result(
  p_session_id uuid,
  p_student_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qs_record RECORD;
  normalized_name text;
  result jsonb;
BEGIN
  normalized_name := trim(COALESCE(p_student_name, ''));
  IF normalized_name = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO qs_record FROM quiz_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF qs_record.status <> 'ended' OR COALESCE(qs_record.reveal_answers, false) = false THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'student_name', normalized_name,
    'answers', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'question_index', qa.question_index,
            'answer', qa.answer,
            'is_correct', qa.is_correct
          )
          ORDER BY qa.question_index
        )
        FROM quiz_answers qa
        WHERE qa.session_id = p_session_id AND trim(qa.student_name) = normalized_name
      ),
      '[]'::jsonb
    ),
    'correct_count', COALESCE(
      (
        SELECT count(*)
        FROM quiz_answers qa
        WHERE qa.session_id = p_session_id
          AND trim(qa.student_name) = normalized_name
          AND qa.is_correct IS TRUE
      ),
      0
    ),
    'objective_total', COALESCE(
      (
        SELECT count(*)
        FROM jsonb_array_elements(qs_record.questions) q
        WHERE COALESCE(q->>'type', '') IN ('single', 'multi', 'tf')
      ),
      0
    )
  ) INTO result;

  RETURN result;
END;
$$;
