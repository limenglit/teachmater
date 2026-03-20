ALTER TABLE public.seat_checkin_sessions
ADD COLUMN IF NOT EXISTS creator_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');

ALTER TABLE public.seat_checkin_sessions
ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 5;

ALTER TABLE public.seat_checkin_sessions
ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone NULL;

ALTER TABLE public.seat_checkin_sessions
ADD COLUMN IF NOT EXISTS class_name text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.update_seat_checkin_session(
  p_session_id uuid,
  p_token text,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM seat_checkin_sessions
    WHERE id = p_session_id AND creator_token = p_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE seat_checkin_sessions SET
    status = COALESCE(p_status, status),
    ended_at = CASE WHEN p_status = 'ended' THEN now() ELSE ended_at END
  WHERE id = p_session_id AND creator_token = p_token;
END;
$$;

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
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM seat_checkin_sessions
    WHERE id = p_session_id AND creator_token = p_token
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM seat_checkin_sessions
  WHERE id = p_session_id AND creator_token = p_token;
END;
$$;
