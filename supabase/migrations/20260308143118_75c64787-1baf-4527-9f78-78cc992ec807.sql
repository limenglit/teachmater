
-- Question bank
CREATE TABLE quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'single',
  content text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer jsonb NOT NULL DEFAULT '""'::jsonb,
  tags text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own questions" ON quiz_questions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Quiz sessions
CREATE TABLE quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  creator_token text NOT NULL DEFAULT gen_random_uuid()::text,
  title text NOT NULL DEFAULT '',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  student_names jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read quiz sessions" ON quiz_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create quiz sessions" ON quiz_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny direct UPDATE quiz sessions" ON quiz_sessions FOR UPDATE USING (false);
CREATE POLICY "Deny direct DELETE quiz sessions" ON quiz_sessions FOR DELETE USING (false);

-- Student answers
CREATE TABLE quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  student_name text NOT NULL DEFAULT '',
  question_index int NOT NULL DEFAULT 0,
  answer jsonb NOT NULL DEFAULT '""'::jsonb,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read quiz answers" ON quiz_answers FOR SELECT USING (true);
CREATE POLICY "Anyone can submit quiz answers" ON quiz_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny UPDATE quiz answers" ON quiz_answers FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE quiz answers" ON quiz_answers FOR DELETE USING (false);

-- Security definer function for session management
CREATE OR REPLACE FUNCTION update_quiz_session(p_session_id uuid, p_token text, p_status text DEFAULT NULL, p_title text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM quiz_sessions WHERE id = p_session_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE quiz_sessions SET
    status = COALESCE(p_status, status),
    title = COALESCE(p_title, title),
    ended_at = CASE WHEN p_status = 'ended' THEN now() ELSE ended_at END
  WHERE id = p_session_id AND creator_token = p_token;
END;
$$;

CREATE OR REPLACE FUNCTION delete_quiz_session(p_session_id uuid, p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM quiz_sessions WHERE id = p_session_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM quiz_sessions WHERE id = p_session_id AND creator_token = p_token;
END;
$$;

-- Enable realtime for live stats
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_answers;
