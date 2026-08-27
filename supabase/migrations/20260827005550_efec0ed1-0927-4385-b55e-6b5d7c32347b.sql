ALTER TABLE public.seat_checkin_records
  ADD COLUMN IF NOT EXISTS org text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';

DROP FUNCTION IF EXISTS public.submit_seat_checkin_record(uuid, text, text);

CREATE OR REPLACE FUNCTION public.submit_seat_checkin_record(
  p_session_id uuid,
  p_student_name text,
  p_otp text DEFAULT NULL::text,
  p_org text DEFAULT ''::text,
  p_phone text DEFAULT ''::text
)
RETURNS TABLE(id uuid, session_id uuid, student_name text, checked_in_at timestamp with time zone, org text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
  v_org text;
  v_phone text;
  v_session RECORD;
  v_otp text;
  v_period int;
  v_epoch bigint := floor(extract(epoch from now()))::bigint;
  v_counter bigint;
  v_match boolean := false;
  v_offset int;
  v_existing_id uuid;
BEGIN
  v_student_name := trim(regexp_replace(replace(COALESCE(p_student_name, ''), chr(12288), ' '), '\s+', ' ', 'g'));
  v_org := left(trim(COALESCE(p_org, '')), 100);
  v_phone := left(trim(COALESCE(p_phone, '')), 30);

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session id is required';
  END IF;

  IF v_student_name = '' THEN
    RAISE EXCEPTION 'Student name is required';
  END IF;

  SELECT s.status, s.otp_enabled, s.otp_secret, s.otp_period_seconds
    INTO v_session
  FROM public.seat_checkin_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND OR v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  IF COALESCE(v_session.otp_enabled, false) AND COALESCE(v_session.otp_secret, '') <> '' THEN
    v_otp := regexp_replace(COALESCE(p_otp, ''), '\D', '', 'g');
    IF length(v_otp) <> 6 THEN
      RAISE EXCEPTION 'INVALID_OTP';
    END IF;
    v_period := GREATEST(COALESCE(v_session.otp_period_seconds, 30), 10);
    v_counter := v_epoch / v_period;
    FOR v_offset IN -1..1 LOOP
      IF public.seat_checkin_otp_code(v_session.otp_secret, v_counter + v_offset) = v_otp THEN
        v_match := true;
      END IF;
    END LOOP;
    IF NOT v_match THEN
      RAISE EXCEPTION 'INVALID_OTP';
    END IF;
  END IF;

  SELECT r.id INTO v_existing_id
  FROM public.seat_checkin_records r
  WHERE r.session_id = p_session_id
    AND r.student_name = v_student_name
  ORDER BY r.checked_in_at ASC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.seat_checkin_records r
      SET org = CASE WHEN v_org <> '' THEN v_org ELSE r.org END,
          phone = CASE WHEN v_phone <> '' THEN v_phone ELSE r.phone END
    WHERE r.id = v_existing_id;

    RETURN QUERY
    SELECT r.id, r.session_id, r.student_name, r.checked_in_at, r.org, r.phone
    FROM public.seat_checkin_records r
    WHERE r.id = v_existing_id;
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.seat_checkin_records (session_id, student_name, org, phone)
  VALUES (p_session_id, v_student_name, v_org, v_phone)
  RETURNING seat_checkin_records.id,
            seat_checkin_records.session_id,
            seat_checkin_records.student_name,
            seat_checkin_records.checked_in_at,
            seat_checkin_records.org,
            seat_checkin_records.phone;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_seat_checkin_record(uuid, text, text, text, text) TO anon, authenticated;