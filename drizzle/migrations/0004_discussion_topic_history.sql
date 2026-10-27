ALTER TABLE public.discussion_topics ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS discussion_topics_user_id_idx ON public.discussion_topics(user_id);

CREATE OR REPLACE FUNCTION public.force_topic_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_force_topic_owner ON public.discussion_topics;
CREATE TRIGGER trg_force_topic_owner BEFORE INSERT ON public.discussion_topics
FOR EACH ROW EXECUTE FUNCTION public.force_topic_owner();

CREATE OR REPLACE FUNCTION public.get_my_discussion_topics(p_tokens text[])
RETURNS TABLE(id uuid, title text, created_at timestamptz, creator_token text, student_count integer, message_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.title, t.created_at, t.creator_token,
    COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(t.student_names)='array' THEN t.student_names ELSE '[]'::jsonb END),0)::int,
    (SELECT count(*) FROM public.barrage_messages m WHERE m.topic_id = t.id)
  FROM public.discussion_topics t
  WHERE (auth.uid() IS NOT NULL AND t.user_id = auth.uid())
     OR (p_tokens IS NOT NULL AND t.creator_token IS NOT NULL AND t.creator_token = ANY(p_tokens))
  ORDER BY t.created_at DESC
  LIMIT 200;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_discussion_topics(text[]) TO anon, authenticated;