-- Restrict student_badges SELECT to badge owners
DROP POLICY IF EXISTS "Authenticated users read student badges" ON public.student_badges;

CREATE POLICY "Owners read student badges"
ON public.student_badges
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.badges b
    WHERE b.id = student_badges.badge_id
      AND (
        b.is_system = true
        OR b.creator_token = student_badges.creator_token
      )
  )
  AND (
    -- Allow if creator_token matches a resource owned by current user
    EXISTS (SELECT 1 FROM public.boards WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.checkin_sessions WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.quiz_sessions WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.polls WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.task_sessions WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.seat_checkin_sessions WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.student_points WHERE creator_token = student_badges.creator_token AND user_id = auth.uid())
  )
);