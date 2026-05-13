CREATE TABLE public.vocab_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_set_id uuid NOT NULL REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  class_name text NOT NULL DEFAULT '',
  student_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_mode text NOT NULL DEFAULT 'match' CHECK (default_mode IN ('match', 'flash')),
  creator_token text NOT NULL DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX idx_vocab_sessions_user_created_at ON public.vocab_sessions(user_id, created_at DESC);

ALTER TABLE public.vocab_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create vocab sessions"
  ON public.vocab_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner reads vocab sessions"
  ON public.vocab_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Deny direct UPDATE vocab sessions"
  ON public.vocab_sessions FOR UPDATE TO public
  USING (false);

CREATE POLICY "Deny direct DELETE vocab sessions"
  ON public.vocab_sessions FOR DELETE TO public
  USING (false);

CREATE OR REPLACE FUNCTION public.get_vocab_session_for_student(p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'title', COALESCE(NULLIF(s.title, ''), vs.title),
    'class_name', s.class_name,
    'status', s.status,
    'default_mode', s.default_mode,
    'student_names', s.student_names,
    'set', jsonb_build_object(
      'id', vs.id,
      'title', vs.title
    ),
    'cards', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'word', c.word,
        'definition', c.definition,
        'example', c.example,
        'wordImage', c.word_image,
        'definitionImage', c.definition_image
      ) ORDER BY c.sort_order)
      FROM public.vocab_cards c
      WHERE c.set_id = s.vocab_set_id
    ), '[]'::jsonb)
  )
  FROM public.vocab_sessions s
  JOIN public.vocab_sets vs ON vs.id = s.vocab_set_id
  WHERE s.id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.update_vocab_session(
  p_session_id uuid,
  p_token text,
  p_status text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_status text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vocab_sessions
    WHERE id = p_session_id AND creator_token = p_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  next_status := COALESCE(p_status, 'active');
  IF next_status NOT IN ('active', 'ended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.vocab_sessions
  SET status = next_status,
      ended_at = CASE WHEN next_status = 'ended' THEN now() ELSE NULL END
  WHERE id = p_session_id AND creator_token = p_token;
END;
$$;