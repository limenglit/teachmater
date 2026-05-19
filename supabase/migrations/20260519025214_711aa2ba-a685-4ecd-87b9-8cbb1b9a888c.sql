CREATE OR REPLACE FUNCTION public.create_seat_checkin_session(
  p_seat_data jsonb,
  p_student_names jsonb,
  p_scene_config jsonb,
  p_scene_type text,
  p_duration_minutes integer DEFAULT 5,
  p_class_name text DEFAULT ''::text
)
RETURNS TABLE(id uuid, creator_token text, created_at timestamp with time zone, duration_minutes integer, status text, ended_at timestamp with time zone, scene_type text, class_name text, student_names jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  INSERT INTO public.seat_checkin_sessions (
    seat_data, student_names, scene_config, scene_type,
    user_id, creator_token, duration_minutes, class_name
  )
  VALUES (
    COALESCE(p_seat_data, '[]'::jsonb),
    COALESCE(p_student_names, '[]'::jsonb),
    COALESCE(p_scene_config, '{}'::jsonb),
    COALESCE(NULLIF(p_scene_type, ''), 'classroom'),
    v_user_id,
    v_token,
    GREATEST(COALESCE(p_duration_minutes, 5), 1),
    COALESCE(p_class_name, '')
  )
  RETURNING seat_checkin_sessions.id INTO v_id;

  RETURN QUERY
  SELECT s.id, s.creator_token, s.created_at, s.duration_minutes,
         s.status, s.ended_at, s.scene_type, s.class_name, s.student_names
  FROM public.seat_checkin_sessions s
  WHERE s.id = v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_seat_checkin_session(jsonb, jsonb, jsonb, text, integer, text) TO anon, authenticated;