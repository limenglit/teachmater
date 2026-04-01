
-- Table for per-user AI quota overrides (admin sets custom limits per user)
CREATE TABLE public.user_ai_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit integer NOT NULL DEFAULT -1,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id)
);

ALTER TABLE public.user_ai_limits ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for the user to check their own limit)
CREATE POLICY "Anyone can read ai limits" ON public.user_ai_limits
  FOR SELECT TO public USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert ai limits" ON public.user_ai_limits
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update ai limits" ON public.user_ai_limits
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete ai limits" ON public.user_ai_limits
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RPC: Admin batch-set AI limits for multiple users
CREATE OR REPLACE FUNCTION public.admin_set_ai_limits(p_user_ids uuid[], p_daily_limit integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  
  INSERT INTO public.user_ai_limits (user_id, daily_limit, updated_at, updated_by)
  SELECT unnest(p_user_ids), p_daily_limit, now(), auth.uid()
  ON CONFLICT (user_id) DO UPDATE SET
    daily_limit = EXCLUDED.daily_limit,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;
END;
$$;

-- RPC: Get all users with their AI limits for admin view
CREATE OR REPLACE FUNCTION public.admin_get_users_with_limits()
RETURNS TABLE(user_id uuid, email text, nickname text, status text, daily_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  
  RETURN QUERY
    SELECT p.user_id, u.email::text, p.nickname, p.status, al.daily_limit
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.user_ai_limits al ON al.user_id = p.user_id
    WHERE p.status = 'approved'
    ORDER BY p.created_at DESC;
END;
$$;
