ALTER TABLE public.task_sessions
ADD COLUMN IF NOT EXISTS class_name text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.update_task_session(
  p_session_id uuid,
  p_token text,
  p_status text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_class_name text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.task_sessions WHERE id = p_session_id AND creator_token = p_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.task_sessions
  SET
    status = COALESCE(p_status, status),
    title = COALESCE(NULLIF(p_title, ''), title),
    class_name = COALESCE(p_class_name, class_name)
  WHERE id = p_session_id AND creator_token = p_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_task_session(p_session_id uuid, p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.task_sessions WHERE id = p_session_id AND creator_token = p_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.task_sessions WHERE id = p_session_id AND creator_token = p_token;
END;
$$;