ALTER TABLE public.seat_checkin_sessions
  ADD COLUMN IF NOT EXISTS otp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS otp_period_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS otp_secret text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.seat_checkin_otp_code(p_secret text, p_counter bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT lpad(
    (
      (('x' || encode(substring(extensions.hmac(p_counter::text, p_secret, 'sha256') FROM 1 FOR 4), 'hex'))::bit(32)::bigint & 2147483647)
      % 1000000
    )::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.get_seat_checkin_otp(p_session_id uuid, p_token text DEFAULT ''::text)
RETURNS TABLE(code text, seconds_remaining integer, period_seconds integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_period int;
  v_enabled boolean;
  v_epoch bigint := floor(extract(epoch from now()))::bigint;
BEGIN
  SELECT s.otp_secret, s.otp_period_seconds, s.otp_enabled
    INTO v_secret, v_period, v_enabled
  FROM public.seat_checkin_sessions s
  WHERE s.id = p_session_id
    AND (
      (p_token IS NOT NULL AND p_token <> '' AND s.creator_token = p_token)
      OR (auth.uid() IS NOT NULL AND s.user_id = auth.uid())
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT COALESCE(v_enabled, false) OR COALESCE(v_secret, '') = '' THEN
    RETURN;
  END IF;

  v_period := GREATEST(COALESCE(v_period, 30), 10);

  RETURN QUERY SELECT
    public.seat_checkin_otp_code(v_secret, v_epoch / v_period),
    (v_period - (v_epoch % v_period))::int,
    v_period;
END;
$$;

DROP FUNCTION IF EXISTS public.create_seat_checkin_session(jsonb, jsonb, jsonb, text, integer, text);

CREATE OR REPLACE FUNCTION public.create_seat_checkin_session(
  p_seat_data jsonb,
  p_student_names jsonb,
  p_scene_config jsonb,
  p_scene_type text,
  p_duration_minutes integer DEFAULT 5,
  p_class_name text DEFAULT ''::text,
  p_otp_enabled boolean DEFAULT false,
  p_otp_period_seconds integer DEFAULT 30
)
RETURNS TABLE(id uuid, creator_token text, created_at timestamp with time zone, duration_minutes integer, status text, ended_at timestamp with time zone, scene_type text, class_name text, student_names jsonb, otp_enabled boolean, otp_period_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_period int := GREATEST(COALESCE(p_otp_period_seconds, 30), 10);
BEGIN
  INSERT INTO public.seat_checkin_sessions (
    seat_data, student_names, scene_config, scene_type,
    user_id, creator_token, duration_minutes, class_name,
    otp_enabled, otp_period_seconds, otp_secret
  )
  VALUES (
    COALESCE(p_seat_data, '[]'::jsonb),
    COALESCE(p_student_names, '[]'::jsonb),
    COALESCE(p_scene_config, '{}'::jsonb),
    COALESCE(NULLIF(p_scene_type, ''), 'classroom'),
    v_user_id,
    v_token,
    GREATEST(COALESCE(p_duration_minutes, 5), 1),
    COALESCE(p_class_name, ''),
    COALESCE(p_otp_enabled, false),
    v_period,
    CASE WHEN COALESCE(p_otp_enabled, false) THEN encode(extensions.gen_random_bytes(32), 'hex') ELSE '' END
  )
  RETURNING seat_checkin_sessions.id INTO v_id;

  RETURN QUERY
  SELECT s.id, s.creator_token, s.created_at, s.duration_minutes,
         s.status, s.ended_at, s.scene_type, s.class_name, s.student_names,
         s.otp_enabled, s.otp_period_seconds
  FROM public.seat_checkin_sessions s
  WHERE s.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seat_checkin_session_for_student(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id, 'status', status, 'scene_type', scene_type,
    'scene_config', scene_config, 'seat_data', seat_data,
    'student_names', student_names, 'created_at', created_at,
    'otp_enabled', COALESCE(otp_enabled, false)
  ) FROM public.seat_checkin_sessions WHERE id = p_session_id;
$$;

DROP FUNCTION IF EXISTS public.submit_seat_checkin_record(uuid, text);

CREATE OR REPLACE FUNCTION public.submit_seat_checkin_record(
  p_session_id uuid,
  p_student_name text,
  p_otp text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, session_id uuid, student_name text, checked_in_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
  v_session RECORD;
  v_otp text;
  v_period int;
  v_epoch bigint := floor(extract(epoch from now()))::bigint;
  v_counter bigint;
  v_match boolean := false;
  v_offset int;
BEGIN
  v_student_name := trim(regexp_replace(replace(COALESCE(p_student_name, ''), chr(12288), ' '), '\s+', ' ', 'g'));

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

REVOKE ALL ON FUNCTION public.seat_checkin_otp_code(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seat_checkin_otp(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_seat_checkin_session(jsonb, jsonb, jsonb, text, integer, text, boolean, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_seat_checkin_record(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seat_checkin_session_for_student(uuid) TO anon, authenticated;