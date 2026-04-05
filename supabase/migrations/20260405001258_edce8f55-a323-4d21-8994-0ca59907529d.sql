
-- Fix 1: Restrict user_ai_limits SELECT to authenticated users reading their own row
DROP POLICY IF EXISTS "Anyone can read ai limits" ON public.user_ai_limits;
CREATE POLICY "Users read own ai limit" ON public.user_ai_limits
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Fix 2: Fix teamwork_history policy - restrict to authenticated only
DROP POLICY IF EXISTS "Users manage own teamwork history" ON public.teamwork_history;
CREATE POLICY "Users manage own teamwork history" ON public.teamwork_history
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix 3: Storage - deny UPDATE and DELETE on all buckets
CREATE POLICY "Deny UPDATE on storage objects" ON storage.objects
  FOR UPDATE TO public USING (false);
CREATE POLICY "Deny DELETE on storage objects" ON storage.objects
  FOR DELETE TO public USING (false);
