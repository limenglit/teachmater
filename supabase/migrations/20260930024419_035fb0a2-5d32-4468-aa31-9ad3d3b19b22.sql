CREATE OR REPLACE FUNCTION public.create_checkin_session(
  p_duration_minutes integer DEFAULT 5,
  p_student_names jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(
  id uuid,
  creator_token text,
  created_at timestamp with time zone,
  duration_minutes integer,
  status text,
  ended_at timestamp with time zone,
  student_names jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  INSERT INTO public.checkin_sessions (
    duration_minutes, student_names, user_id, creator_token
  )
  VALUES (
    GREATEST(COALESCE(p_duration_minutes, 5), 1),
    COALESCE(p_student_names, '[]'::jsonb),
    v_user_id,
    v_token
  )
  RETURNING checkin_sessions.id INTO v_id;

  RETURN QUERY
  SELECT s.id, s.creator_token, s.created_at, s.duration_minutes,
         s.status, s.ended_at, s.student_names
  FROM public.checkin_sessions s
  WHERE s.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkin_session(integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkin_session(integer, jsonb) TO anon, authenticated;

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

REVOKE ALL ON FUNCTION public.create_seat_checkin_session(jsonb, jsonb, jsonb, text, integer, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_seat_checkin_session(jsonb, jsonb, jsonb, text, integer, text, boolean, integer) TO anon, authenticated;