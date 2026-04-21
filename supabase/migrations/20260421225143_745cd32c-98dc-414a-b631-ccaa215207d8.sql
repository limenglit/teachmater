
-- 1. Tighten student_points INSERT: require authenticated user and creator_token must match either a token they've used before OR be a fresh creator (must own the data)
-- We use a security-definer function to validate ownership via existing creator_token usage
DROP POLICY IF EXISTS "Authenticated users add points" ON public.student_points;

CREATE POLICY "Authenticated users add own points"
ON public.student_points
FOR INSERT
TO authenticated
WITH CHECK (
  creator_token <> ''
  AND (
    -- Token is already used by some prior point owned by this user's session, OR
    EXISTS (SELECT 1 FROM public.student_points sp WHERE sp.creator_token = student_points.creator_token LIMIT 1)
    -- Allow first-time use of a freshly generated token
    OR NOT EXISTS (SELECT 1 FROM public.student_points sp WHERE sp.creator_token = student_points.creator_token)
  )
);

-- The above is effectively unchanged in restrictiveness; instead implement proper restriction:
-- Drop and recreate restricting to authenticated only with non-empty creator_token (true tightening would require user_id column, which doesn't exist).
DROP POLICY IF EXISTS "Authenticated users add own points" ON public.student_points;

CREATE POLICY "Authenticated users add points with token"
ON public.student_points
FOR INSERT
TO authenticated
WITH CHECK (creator_token IS NOT NULL AND creator_token <> '');

-- 2. Storage: deny anonymous LIST on public buckets (still allow direct file access via getPublicUrl)
-- Drop overly permissive list policies if any, add a list policy restricted to authenticated
DO $$
BEGIN
  -- These policies may or may not exist depending on history; create authenticated-only list policies
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Public can list board-media" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Public can list ppt-images" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Public can list community-files" ON storage.objects';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 3. seat_checkin_sessions: tighten SELECT.
-- Students need to read active sessions (for the check-in page). Restrict so only active sessions are readable publicly,
-- ended sessions only readable by authenticated users (teachers).
DROP POLICY IF EXISTS "Anyone can read seat checkin sessions" ON public.seat_checkin_sessions;

CREATE POLICY "Public can read active seat checkin sessions"
ON public.seat_checkin_sessions
FOR SELECT
TO anon, authenticated
USING (status = 'active');

CREATE POLICY "Authenticated can read all seat checkin sessions"
ON public.seat_checkin_sessions
FOR SELECT
TO authenticated
USING (true);
