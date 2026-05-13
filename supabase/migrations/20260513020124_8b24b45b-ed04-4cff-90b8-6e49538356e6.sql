-- 1. Add missing columns
ALTER TABLE public.seat_checkin_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS class_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- 2. RPC: create a seat checkin session (works for both authenticated & anon teachers)
CREATE OR REPLACE FUNCTION public.create_seat_checkin_session(
  p_seat_data jsonb,
  p_student_names jsonb,
  p_scene_config jsonb,
  p_scene_type text,
  p_duration_minutes integer DEFAULT 5,
  p_class_name text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  creator_token text,
  created_at timestamptz,
  duration_minutes integer,
  status text,
  ended_at timestamptz,
  scene_type text,
  class_name text,
  student_names jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text := encode(gen_random_bytes(24), 'hex');
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
$$;

GRANT EXECUTE ON FUNCTION public.create_seat_checkin_session(jsonb, jsonb, jsonb, text, integer, text)
  TO anon, authenticated;

-- 3. RPC: token-aware update overload (status / ended_at)
CREATE OR REPLACE FUNCTION public.update_seat_checkin_session(
  p_session_id uuid,
  p_token text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.seat_checkin_sessions
  SET status = COALESCE(p_status, status),
      ended_at = CASE
        WHEN p_status IN ('ended', 'deleted') THEN COALESCE(ended_at, now())
        ELSE ended_at
      END
  WHERE id = p_session_id
    AND (
      (p_token IS NOT NULL AND creator_token = p_token)
      OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_seat_checkin_session(uuid, text, text)
  TO anon, authenticated;

-- 4. RPC: hard delete by token
CREATE OR REPLACE FUNCTION public.delete_seat_checkin_session(
  p_session_id uuid,
  p_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.seat_checkin_sessions
  WHERE id = p_session_id
    AND (
      (p_token IS NOT NULL AND creator_token = p_token)
      OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_seat_checkin_session(uuid, text)
  TO anon, authenticated;

-- 5. Allow anon owners (via creator_token cached client-side) to read their own
-- sessions through the existing token RPC. Recreate token-list RPC so it
-- returns the new columns automatically (SETOF table picks them up).
-- (Function body was already SETOF seat_checkin_sessions; no change needed.)
