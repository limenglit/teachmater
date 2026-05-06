
-- 1) teamwork_sessions: add user_id and lock SELECT to owner only
ALTER TABLE public.teamwork_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid;

DROP POLICY IF EXISTS "Auth users read teamwork sessions" ON public.teamwork_sessions;
CREATE POLICY "Owner reads teamwork sessions"
  ON public.teamwork_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tighten INSERT: authenticated users only and must set their own user_id
DROP POLICY IF EXISTS "Anyone can create teamwork sessions" ON public.teamwork_sessions;
CREATE POLICY "Auth users create own teamwork sessions"
  ON public.teamwork_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2) student_points: trigger to verify creator_token belongs to the authenticated user
CREATE OR REPLACE FUNCTION public.validate_student_points_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'user_id must match auth.uid()';
  END IF;
  IF NEW.creator_token IS NULL OR NEW.creator_token = '' THEN
    RAISE EXCEPTION 'creator_token required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.boards WHERE creator_token = NEW.creator_token AND user_id = NEW.user_id
    UNION ALL
    SELECT 1 FROM public.polls WHERE creator_token = NEW.creator_token AND user_id = NEW.user_id
    UNION ALL
    SELECT 1 FROM public.checkin_sessions WHERE creator_token = NEW.creator_token AND user_id = NEW.user_id
    UNION ALL
    SELECT 1 FROM public.quiz_sessions WHERE creator_token = NEW.creator_token AND user_id = NEW.user_id
    UNION ALL
    SELECT 1 FROM public.seat_checkin_sessions WHERE creator_token = NEW.creator_token AND user_id = NEW.user_id
    UNION ALL
    SELECT 1 FROM public.task_sessions WHERE creator_token = NEW.creator_token AND user_id = NEW.user_id
    UNION ALL
    SELECT 1 FROM public.student_points WHERE creator_token = NEW.creator_token AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'creator_token does not belong to this user';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_student_points_token ON public.student_points;
CREATE TRIGGER trg_validate_student_points_token
  BEFORE INSERT ON public.student_points
  FOR EACH ROW EXECUTE FUNCTION public.validate_student_points_token();

-- 3) ppt-images storage: restrict uploads to user's own folder (auth.uid()/...)
DROP POLICY IF EXISTS "Auth users upload ppt-images" ON storage.objects;
CREATE POLICY "Auth users upload own ppt-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ppt-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
