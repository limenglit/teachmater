-- Allow the authenticated owner (user_id) to end/delete a check-in session even
-- when the local creator_token is unavailable (other device / cleared storage).

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
  IF NOT EXISTS (
    SELECT 1 FROM public.seat_checkin_sessions
    WHERE id = p_session_id
      AND (
        (p_token IS NOT NULL AND p_token <> '' AND creator_token = p_token)
        OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.seat_checkin_sessions SET
    status = COALESCE(p_status, status),
    ended_at = CASE WHEN p_status = 'ended' THEN now() ELSE ended_at END
  WHERE id = p_session_id;
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
  IF NOT EXISTS (
    SELECT 1 FROM public.seat_checkin_sessions
    WHERE id = p_session_id
      AND (
        (p_token IS NOT NULL AND p_token <> '' AND creator_token = p_token)
        OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.seat_checkin_sessions WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_checkin_session(
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
  IF NOT EXISTS (
    SELECT 1 FROM public.checkin_sessions
    WHERE id = p_session_id
      AND (
        (p_token IS NOT NULL AND p_token <> '' AND creator_token = p_token)
        OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.checkin_sessions SET
    status = COALESCE(p_status, status),
    ended_at = CASE WHEN p_status = 'ended' THEN now() ELSE ended_at END
  WHERE id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_seat_checkin_session(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_seat_checkin_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_checkin_session(uuid, text, text) TO anon, authenticated;