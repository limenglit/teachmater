-- Add per-session toggle: whether students can view reference answers after quiz ended
ALTER TABLE public.quiz_sessions
ADD COLUMN IF NOT EXISTS reveal_answers boolean NOT NULL DEFAULT false;

-- Extend session update RPC to support reveal_answers switch
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

-- Student session RPC: only reveal correct_answer when session ended and reveal_answers=true
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
