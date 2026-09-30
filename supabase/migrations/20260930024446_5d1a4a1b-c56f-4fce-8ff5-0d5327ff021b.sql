DROP POLICY IF EXISTS "Guest teachers create checkin sessions" ON public.checkin_sessions;
CREATE POLICY "Guest teachers create checkin sessions"
  ON public.checkin_sessions
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND length(COALESCE(creator_token, '')) >= 32
    AND duration_minutes >= 1
  );

DROP POLICY IF EXISTS "Guest teachers create seat checkin sessions" ON public.seat_checkin_sessions;
CREATE POLICY "Guest teachers create seat checkin sessions"
  ON public.seat_checkin_sessions
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND length(COALESCE(creator_token, '')) >= 32
    AND duration_minutes >= 1
    AND otp_period_seconds >= 10
  );

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
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
BEGIN
  RETURN QUERY
  INSERT INTO public.checkin_sessions (
    duration_minutes, student_names, user_id, creator_token
  )
  VALUES (
    GREATEST(COALESCE(p_duration_minutes, 5), 1),
    CASE WHEN jsonb_typeof(COALESCE(p_student_names, '[]'::jsonb)) = 'array'
         THEN COALESCE(p_student_names, '[]'::jsonb) ELSE '[]'::jsonb END,
    auth.uid(),
    v_token
  )
  RETURNING checkin_sessions.id, checkin_sessions.creator_token,
            checkin_sessions.created_at, checkin_sessions.duration_minutes,
            checkin_sessions.status, checkin_sessions.ended_at,
            checkin_sessions.student_names;
END;
$$;

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
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_period int := GREATEST(COALESCE(p_otp_period_seconds, 30), 10);
BEGIN
  RETURN QUERY
  INSERT INTO public.seat_checkin_sessions (
    seat_data, student_names, scene_config, scene_type,
    user_id, creator_token, duration_minutes, class_name,
    otp_enabled, otp_period_seconds, otp_secret
  )
  VALUES (
    COALESCE(p_seat_data, '[]'::jsonb),
    CASE WHEN jsonb_typeof(COALESCE(p_student_names, '[]'::jsonb)) = 'array'
         THEN COALESCE(p_student_names, '[]'::jsonb) ELSE '[]'::jsonb END,
    CASE WHEN jsonb_typeof(COALESCE(p_scene_config, '{}'::jsonb)) = 'object'
         THEN COALESCE(p_scene_config, '{}'::jsonb) ELSE '{}'::jsonb END,
    COALESCE(NULLIF(p_scene_type, ''), 'classroom'),
    auth.uid(),
    v_token,
    GREATEST(COALESCE(p_duration_minutes, 5), 1),
    COALESCE(p_class_name, ''),
    COALESCE(p_otp_enabled, false),
    v_period,
    CASE WHEN COALESCE(p_otp_enabled, false) THEN encode(extensions.gen_random_bytes(32), 'hex') ELSE '' END
  )
  RETURNING seat_checkin_sessions.id, seat_checkin_sessions.creator_token,
            seat_checkin_sessions.created_at, seat_checkin_sessions.duration_minutes,
            seat_checkin_sessions.status, seat_checkin_sessions.ended_at,
            seat_checkin_sessions.scene_type, seat_checkin_sessions.class_name,
            seat_checkin_sessions.student_names, seat_checkin_sessions.otp_enabled,
            seat_checkin_sessions.otp_period_seconds;
END;
$$;