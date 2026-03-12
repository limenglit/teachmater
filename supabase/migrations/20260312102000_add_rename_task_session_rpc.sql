CREATE OR REPLACE FUNCTION public.rename_task_session(
  p_session_id uuid,
  p_token text,
  p_title text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.task_sessions WHERE id = p_session_id AND creator_token = p_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.task_sessions
  SET title = btrim(p_title)
  WHERE id = p_session_id AND creator_token = p_token;
END;
$$;
