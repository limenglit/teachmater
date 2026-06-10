CREATE OR REPLACE FUNCTION public.submit_seat_checkin_record(
  p_session_id uuid,
  p_student_name text
)
RETURNS TABLE(id uuid, session_id uuid, student_name text, checked_in_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
BEGIN
  v_student_name := trim(regexp_replace(replace(COALESCE(p_student_name, ''), chr(12288), ' '), '\s+', ' ', 'g'));

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session id is required';
  END IF;

  IF v_student_name = '' THEN
    RAISE EXCEPTION 'Student name is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.seat_checkin_sessions s
    WHERE s.id = p_session_id
      AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  RETURN QUERY
  SELECT r.id, r.session_id, r.student_name, r.checked_in_at
  FROM public.seat_checkin_records r
  WHERE r.session_id = p_session_id
    AND r.student_name = v_student_name
  ORDER BY r.checked_in_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.seat_checkin_records (session_id, student_name)
  VALUES (p_session_id, v_student_name)
  RETURNING seat_checkin_records.id,
            seat_checkin_records.session_id,
            seat_checkin_records.student_name,
            seat_checkin_records.checked_in_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_seat_checkin_record(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_seat_checkin_record(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seat_checkin_guest_records(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seat_checkin_session_for_student(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seat_checkin_records_for_owner(uuid, text) TO anon, authenticated;

GRANT INSERT ON public.seat_checkin_records TO anon, authenticated;
GRANT SELECT ON public.seat_checkin_records TO authenticated;
GRANT ALL ON public.seat_checkin_records TO service_role;
GRANT SELECT, INSERT ON public.seat_checkin_sessions TO authenticated;
GRANT ALL ON public.seat_checkin_sessions TO service_role;