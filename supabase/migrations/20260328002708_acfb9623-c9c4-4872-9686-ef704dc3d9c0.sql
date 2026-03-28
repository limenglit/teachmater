
-- Fix: Change quiz_questions RLS policy from 'public' to 'authenticated' role
DROP POLICY IF EXISTS "Users manage own questions" ON public.quiz_questions;

CREATE POLICY "Users manage own questions"
ON public.quiz_questions
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
