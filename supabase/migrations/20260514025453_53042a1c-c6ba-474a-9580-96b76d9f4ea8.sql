
-- Create vocab_sessions table for QR-published vocab learning sessions
CREATE TABLE public.vocab_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_set_id uuid NOT NULL REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  creator_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  title text NOT NULL DEFAULT '',
  class_name text NOT NULL DEFAULT '',
  student_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_mode text NOT NULL DEFAULT 'match',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE public.vocab_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads vocab sessions"
  ON public.vocab_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Auth users create own vocab sessions"
  ON public.vocab_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Deny direct UPDATE vocab_sessions"
  ON public.vocab_sessions FOR UPDATE TO public
  USING (false);

CREATE POLICY "Deny direct DELETE vocab_sessions"
  ON public.vocab_sessions FOR DELETE TO public
  USING (false);

CREATE INDEX idx_vocab_sessions_user ON public.vocab_sessions(user_id, created_at DESC);

-- RPC: student-side loader returns set info + cards
CREATE OR REPLACE FUNCTION public.get_vocab_session_for_student(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  cards_out jsonb;
BEGIN
  SELECT * INTO s FROM public.vocab_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'word', c.word,
    'definition', c.definition,
    'example', c.example,
    'wordImage', c.word_image,
    'definitionImage', c.definition_image
  ) ORDER BY c.sort_order), '[]'::jsonb)
  INTO cards_out
  FROM public.vocab_cards c
  WHERE c.set_id = s.vocab_set_id;

  RETURN jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'class_name', s.class_name,
    'status', s.status,
    'default_mode', s.default_mode,
    'student_names', s.student_names,
    'set', (SELECT jsonb_build_object('id', vs.id, 'title', vs.title)
            FROM public.vocab_sets vs WHERE vs.id = s.vocab_set_id),
    'cards', cards_out
  );
END;
$$;

-- RPC: owner updates session (status etc.) via creator_token
CREATE OR REPLACE FUNCTION public.update_vocab_session(
  p_session_id uuid, p_token text, p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vocab_sessions WHERE id = p_session_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.vocab_sessions SET
    status = COALESCE(p_status, status),
    ended_at = CASE WHEN p_status = 'ended' THEN COALESCE(ended_at, now()) ELSE ended_at END
  WHERE id = p_session_id AND creator_token = p_token;
END;
$$;
