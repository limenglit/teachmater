
-- Remove broad public SELECT policies that leak creator_token
DROP POLICY IF EXISTS "Anyone can read badges" ON public.badges;
DROP POLICY IF EXISTS "Anyone can read boards" ON public.boards;
DROP POLICY IF EXISTS "Anyone can read polls" ON public.polls;
DROP POLICY IF EXISTS "Anyone can read topics" ON public.discussion_topics;

-- Owner SELECT for tables that have user_id
CREATE POLICY "Owners can read own boards"
  ON public.boards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners can read own polls"
  ON public.polls FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Security-definer RPCs for token / public read paths
CREATE OR REPLACE FUNCTION public.get_boards_by_tokens(p_tokens text[])
RETURNS SETOF public.boards
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.boards
  WHERE p_tokens IS NOT NULL
    AND array_length(p_tokens, 1) > 0
    AND creator_token = ANY(p_tokens)
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_polls_by_tokens(p_tokens text[])
RETURNS SETOF public.polls
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.polls
  WHERE p_tokens IS NOT NULL
    AND array_length(p_tokens, 1) > 0
    AND creator_token = ANY(p_tokens)
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_poll_for_voter(p_poll_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', id,
    'title', title,
    'poll_type', poll_type,
    'options', options,
    'status', status
  )
  FROM public.polls WHERE id = p_poll_id;
$$;

CREATE OR REPLACE FUNCTION public.get_badges_by_token(p_token text)
RETURNS SETOF public.badges
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.badges
  WHERE p_token IS NOT NULL
    AND p_token <> ''
    AND creator_token = p_token
  ORDER BY created_at;
$$;

CREATE OR REPLACE FUNCTION public.get_discussion_topic_for_student(p_topic_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', title,
    'student_names', student_names
  )
  FROM public.discussion_topics WHERE id = p_topic_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_boards_by_tokens(text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_polls_by_tokens(text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_for_voter(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_badges_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_discussion_topic_for_student(uuid) TO anon, authenticated;
