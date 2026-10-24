CREATE OR REPLACE FUNCTION public.teacher_add_checkin_record(p_session_id uuid, p_token text, p_student_name text)
RETURNS SETOF public.checkin_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_existing uuid;
BEGIN
  v_name := left(trim(regexp_replace(replace(COALESCE(p_student_name, ''), chr(12288), ' '), '\s+', ' ', 'g')), 64);
  IF v_name = '' THEN
    RAISE EXCEPTION 'Student name is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checkin_sessions s
    WHERE s.id = p_session_id
      AND s.status <> 'deleted'
      AND (
        (p_token IS NOT NULL AND p_token <> '' AND s.creator_token = p_token)
        OR (auth.uid() IS NOT NULL AND s.user_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT r.id INTO v_existing
  FROM public.checkin_records r
  WHERE r.session_id = p_session_id
    AND r.student_name = v_name
    AND r.status = 'matched'
  ORDER BY r.checked_in_at ASC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT r.* FROM public.checkin_records r WHERE r.id = v_existing;
    RETURN;
  END IF;

  PERFORM set_config('app.teacher_checkin', '1', true);
  RETURN QUERY
  INSERT INTO public.checkin_records (session_id, student_name, status, checkin_method)
  VALUES (p_session_id, v_name, 'matched', 'teacher')
  RETURNING *;
  PERFORM set_config('app.teacher_checkin', '', true);
END;
$function$;