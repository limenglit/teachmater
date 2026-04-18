CREATE OR REPLACE FUNCTION public.merge_seat_checkin_guests(
  p_session_id uuid,
  p_seat_data jsonb,
  p_student_names jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM seat_checkin_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  UPDATE seat_checkin_sessions
    SET seat_data = COALESCE(p_seat_data, seat_data),
        student_names = COALESCE(p_student_names, student_names)
    WHERE id = p_session_id;
END;
$$;