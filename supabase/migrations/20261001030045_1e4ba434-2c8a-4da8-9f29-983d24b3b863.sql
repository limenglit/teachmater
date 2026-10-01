CREATE OR REPLACE FUNCTION public.checkin_session_is_active(p_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.checkin_sessions WHERE id = p_session_id AND status = 'active');
$$;
GRANT EXECUTE ON FUNCTION public.checkin_session_is_active(uuid) TO anon, authenticated;
DROP POLICY "Insert to active sessions only" ON public.checkin_records;
CREATE POLICY "Insert to active sessions only" ON public.checkin_records FOR INSERT TO anon, authenticated
  WITH CHECK (public.checkin_session_is_active(session_id) AND length(btrim(student_name)) BETWEEN 1 AND 64);