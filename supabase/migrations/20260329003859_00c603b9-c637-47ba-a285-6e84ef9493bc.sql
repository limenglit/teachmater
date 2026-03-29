
-- Fix quiz_answers: restrict SELECT to quiz session owner only
DROP POLICY IF EXISTS "Authenticated users read quiz answers" ON public.quiz_answers;

CREATE POLICY "Session owner reads quiz answers"
ON public.quiz_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_sessions qs
    WHERE qs.id = quiz_answers.session_id
      AND qs.user_id = auth.uid()
  )
);
