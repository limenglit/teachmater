
-- 1. Lock down consume_ai_quota: only service-role (edge functions) may call it.
REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid) TO service_role;

-- 2. Drop the legacy unprotected update_seat_checkin_session(uuid, text) overload.
DROP FUNCTION IF EXISTS public.update_seat_checkin_session(uuid, text);

-- 3. Replace merge_seat_checkin_guests with a token-guarded overload, drop unguarded one.
DROP FUNCTION IF EXISTS public.merge_seat_checkin_guests(uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.merge_seat_checkin_guests(
  p_session_id uuid,
  p_token text,
  p_seat_data jsonb,
  p_student_names jsonb
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
      AND (creator_token = p_token OR user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.seat_checkin_sessions
  SET seat_data = p_seat_data,
      student_names = p_student_names
  WHERE id = p_session_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_seat_checkin_guests(uuid, text, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.merge_seat_checkin_guests(uuid, text, jsonb, jsonb) TO anon, authenticated;

-- 4. Tighten session INSERT policies — require authenticated owner.
DROP POLICY IF EXISTS "Anyone can create quiz sessions" ON public.quiz_sessions;
CREATE POLICY "Authenticated users create own quiz sessions"
  ON public.quiz_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can create task sessions" ON public.task_sessions;
CREATE POLICY "Authenticated users create own task sessions"
  ON public.task_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can create seat checkin sessions" ON public.seat_checkin_sessions;
CREATE POLICY "Authenticated users create own seat checkin sessions"
  ON public.seat_checkin_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can create sessions" ON public.checkin_sessions;
CREATE POLICY "Authenticated users create own checkin sessions"
  ON public.checkin_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5. Tighten badges INSERT — only non-system badges, and creator_token must be non-empty.
DROP POLICY IF EXISTS "Authenticated users create badges" ON public.badges;
CREATE POLICY "Authenticated users create non-system badges"
  ON public.badges
  FOR INSERT TO authenticated
  WITH CHECK (is_system = false AND length(coalesce(creator_token, '')) > 0);

-- 6. Restrict community-files storage uploads to the user's own folder.
DROP POLICY IF EXISTS "Auth users upload community files" ON storage.objects;
CREATE POLICY "Auth users upload community files"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
