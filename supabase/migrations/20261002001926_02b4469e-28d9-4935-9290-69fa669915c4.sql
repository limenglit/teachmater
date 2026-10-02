-- Atomically create a whiteboard for both signed-in teachers and guests.
-- Returns the full row (including creator_token) so guests can keep ownership
-- without needing SELECT rights on the boards table.
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
    encode(gen_random_bytes(24), 'hex'),
    coalesce(p_is_collaborative, false)
  )
  RETURNING * INTO v_row;
  RETURN to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_board(text, boolean) TO anon, authenticated;

-- Atomically create a quiz session for both signed-in teachers and guests.
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
    encode(gen_random_bytes(24), 'hex'),
    coalesce(p_questions, '[]'::jsonb),
    coalesce(p_student_names, '[]'::jsonb),
    coalesce(p_reveal_answers, true)
  )
  RETURNING * INTO v_row;
  RETURN to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_quiz_session(text, jsonb, jsonb, boolean) TO anon, authenticated;