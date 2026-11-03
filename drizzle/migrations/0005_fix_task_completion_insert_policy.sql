CREATE OR REPLACE FUNCTION public.task_session_is_active(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.task_sessions WHERE id = p_session_id AND status = 'active');
$$;

REVOKE ALL ON FUNCTION public.task_session_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.task_session_is_active(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Insert to active task sessions only" ON public.task_completions;
CREATE POLICY "Insert to active task sessions only" ON public.task_completions
  FOR INSERT TO public
  WITH CHECK (public.task_session_is_active(session_id));