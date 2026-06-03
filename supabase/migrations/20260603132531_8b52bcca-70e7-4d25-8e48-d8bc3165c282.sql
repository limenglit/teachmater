-- Helper: approved-user check (admins always allowed)
CREATE OR REPLACE FUNCTION public.is_approved_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = _user_id AND status = 'approved'
    );
$$;

-- Trigger: block writes to user_pages for non-approved users
CREATE OR REPLACE FUNCTION public.enforce_user_pages_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_approved_user(NEW.user_id) THEN
    RAISE EXCEPTION 'Account not approved: HTML page publishing requires admin approval.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_pages_approval_ins ON public.user_pages;
CREATE TRIGGER enforce_user_pages_approval_ins
  BEFORE INSERT ON public.user_pages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_pages_approval();

DROP TRIGGER IF EXISTS enforce_user_pages_approval_upd ON public.user_pages;
CREATE TRIGGER enforce_user_pages_approval_upd
  BEFORE UPDATE ON public.user_pages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_pages_approval();

-- Tighten storage policies: only approved users (or admins) can write to user-pages bucket
DROP POLICY IF EXISTS user_pages_auth_insert ON storage.objects;
CREATE POLICY user_pages_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-pages'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND public.is_approved_user(auth.uid())
  );

DROP POLICY IF EXISTS user_pages_auth_update ON storage.objects;
CREATE POLICY user_pages_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-pages'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'user-pages'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND public.is_approved_user(auth.uid())
  );