-- Restrict student_points SELECT to owners only
DROP POLICY IF EXISTS "Authenticated users read points" ON public.student_points;
CREATE POLICY "Owners read own student points"
  ON public.student_points
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Tighten student_badges INSERT: require creator_token to belong to a resource owned by auth.uid()
DROP POLICY IF EXISTS "Auth users award own badges" ON public.student_badges;
CREATE POLICY "Auth users award own badges"
  ON public.student_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_token <> ''
    AND EXISTS (
      SELECT 1 FROM public.badges b
      WHERE b.id = student_badges.badge_id
        AND (b.creator_token = student_badges.creator_token OR b.is_system = true)
    )
    AND (
      EXISTS (SELECT 1 FROM public.boards WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.checkin_sessions WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.quiz_sessions WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.polls WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.task_sessions WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.seat_checkin_sessions WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.student_points WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
    )
  );