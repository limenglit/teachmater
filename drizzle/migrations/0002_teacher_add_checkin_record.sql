ALTER TABLE public.checkin_records ADD COLUMN IF NOT EXISTS checkin_method text NOT NULL DEFAULT 'scan';

-- Students insert directly; only the owner-checked RPC below may mark a record as a teacher make-up.
CREATE OR REPLACE FUNCTION public.enforce_checkin_record_method()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(current_setting('app.teacher_checkin', true), '') <> '1' THEN
    NEW.checkin_method := 'scan';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_checkin_record_method ON public.checkin_records;
CREATE TRIGGER enforce_checkin_record_method
BEFORE INSERT ON public.checkin_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_checkin_record_method();

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
    AND trim(regexp_replace(replace(r.student_name, chr(12288), ' '), '\s+', ' ', 'g')) = v_name
  ORDER BY (r.status = 'matched') DESC, r.checked_in_at ASC
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

REVOKE ALL ON FUNCTION public.teacher_add_checkin_record(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.teacher_add_checkin_record(uuid, text, text) TO anon, authenticated, service_role;