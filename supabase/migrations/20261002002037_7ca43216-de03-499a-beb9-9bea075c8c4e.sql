-- gen_random_bytes is unavailable (pgcrypto not enabled); use uuid-based tokens instead.
CREATE OR REPLACE FUNCTION public.create_board(p_title text DEFAULT '', p_is_collaborative boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row boards%ROWTYPE;
BEGIN
  INSERT INTO boards (title, user_id, creator_token, is_collaborative)
  VALUES (
    left(coalesce(nullif(trim(p_title), ''), '白板'), 120),
    auth.uid(),
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    coalesce(p_is_collaborative, false)
  )
  RETURNING * INTO v_row;
  RETURN to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_board(text, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_quiz_session(
  p_title text DEFAULT '',
  p_questions jsonb DEFAULT '[]'::jsonb,
  p_student_names jsonb DEFAULT '[]'::jsonb,
  p_reveal_answers boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row quiz_sessions%ROWTYPE;
BEGIN
  INSERT INTO quiz_sessions (title, user_id, creator_token, questions, student_names, reveal_answers)
  VALUES (
    left(coalesce(nullif(trim(p_title), ''), '课堂测验'), 120),
    auth.uid(),
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    coalesce(p_questions, '[]'::jsonb),
    coalesce(p_student_names, '[]'::jsonb),
    coalesce(p_reveal_answers, true)
  )
  RETURNING * INTO v_row;
  RETURN to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_quiz_session(text, jsonb, jsonb, boolean) TO anon, authenticated;