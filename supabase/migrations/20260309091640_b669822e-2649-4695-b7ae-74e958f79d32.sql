
-- =============================================
-- FIX 1: Hide correct answers from quiz students
-- =============================================

-- Function: return quiz session with correct_answer stripped from questions
CREATE OR REPLACE FUNCTION public.get_quiz_session_for_student(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  stripped_questions jsonb;
BEGIN
  SELECT jsonb_agg(
    q - 'correct_answer'
  )
  INTO stripped_questions
  FROM quiz_sessions qs,
       jsonb_array_elements(qs.questions) AS q
  WHERE qs.id = p_session_id;

  SELECT jsonb_build_object(
    'id', qs.id,
    'title', qs.title,
    'status', qs.status,
    'student_names', qs.student_names,
    'questions', COALESCE(stripped_questions, '[]'::jsonb)
  )
  INTO result
  FROM quiz_sessions qs
  WHERE qs.id = p_session_id;

  RETURN result;
END;
$$;

-- Function: grade and insert quiz answers server-side
CREATE OR REPLACE FUNCTION public.submit_quiz_answers(
  p_session_id uuid,
  p_student_name text,
  p_answers jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_record RECORD;
  q jsonb;
  i int;
  student_answer jsonb;
  correct jsonb;
  is_correct boolean;
  q_type text;
BEGIN
  -- Validate session exists and is active
  SELECT * INTO session_record FROM quiz_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF session_record.status <> 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;
  IF p_student_name IS NULL OR trim(p_student_name) = '' THEN
    RAISE EXCEPTION 'Student name is required';
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
      -- Compare sorted arrays
      is_correct := (
        (SELECT jsonb_agg(v ORDER BY v) FROM jsonb_array_elements_text(COALESCE(student_answer, '[]'::jsonb)) v) =
        (SELECT jsonb_agg(v ORDER BY v) FROM jsonb_array_elements_text(COALESCE(correct, '[]'::jsonb)) v)
      );
    END IF;
    -- short answer: is_correct stays NULL

    INSERT INTO quiz_answers (session_id, student_name, question_index, answer, is_correct)
    VALUES (p_session_id, trim(p_student_name), i, COALESCE(student_answer, '""'::jsonb), is_correct);

    i := i + 1;
  END LOOP;
END;
$$;

-- =============================================
-- FIX 2: Restrict checkin_sessions UPDATE to owner
-- =============================================

-- Create RPC for updating checkin sessions (same pattern as update_poll)
CREATE OR REPLACE FUNCTION public.update_checkin_session(
  p_session_id uuid,
  p_token text,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM checkin_sessions WHERE id = p_session_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE checkin_sessions SET
    status = COALESCE(p_status, status),
    ended_at = CASE WHEN p_status = 'ended' THEN now() ELSE ended_at END
  WHERE id = p_session_id AND creator_token = p_token;
END;
$$;

-- Same for seat_checkin_sessions (has identical vulnerability)
CREATE OR REPLACE FUNCTION public.update_seat_checkin_session(
  p_session_id uuid,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- seat_checkin_sessions has no creator_token, so just validate session exists
  IF NOT EXISTS (SELECT 1 FROM seat_checkin_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  UPDATE seat_checkin_sessions SET
    status = COALESCE(p_status, status)
  WHERE id = p_session_id;
END;
$$;

-- Drop the overly permissive UPDATE policy and replace with deny
DROP POLICY IF EXISTS "Creator can update sessions" ON checkin_sessions;
CREATE POLICY "Deny direct UPDATE checkin_sessions" ON checkin_sessions FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Creator can update seat checkin sessions" ON seat_checkin_sessions;
CREATE POLICY "Deny direct UPDATE seat_checkin_sessions" ON seat_checkin_sessions FOR UPDATE USING (false);
