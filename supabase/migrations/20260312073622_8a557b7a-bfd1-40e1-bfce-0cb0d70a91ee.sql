
CREATE OR REPLACE FUNCTION public.delete_task_session(p_session_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.task_completions WHERE session_id = p_session_id;
  DELETE FROM public.task_sessions
    WHERE id = p_session_id
      AND creator_token = p_token;
END;
$$;
