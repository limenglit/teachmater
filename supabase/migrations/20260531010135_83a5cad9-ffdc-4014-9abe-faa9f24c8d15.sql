-- Per-user page publish limits (similar to user_ai_limits)
CREATE TABLE IF NOT EXISTS public.user_page_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  page_limit integer NOT NULL DEFAULT -1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.user_page_limits TO authenticated;
GRANT ALL ON public.user_page_limits TO service_role;

ALTER TABLE public.user_page_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own page limit"
  ON public.user_page_limits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins insert page limits"
  ON public.user_page_limits FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update page limits"
  ON public.user_page_limits FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete page limits"
  ON public.user_page_limits FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Resolve effective limit for a user: per-user override, else system_config.registered.page_limit, else 5
CREATE OR REPLACE FUNCTION public.get_effective_page_limit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
BEGIN
  IF public.has_role(p_user_id, 'admin') THEN RETURN -1; END IF;
  SELECT page_limit INTO v_limit FROM public.user_page_limits WHERE user_id = p_user_id;
  IF v_limit IS NOT NULL THEN RETURN v_limit; END IF;
  SELECT COALESCE((config->'registered'->>'page_limit')::int, 5)
    INTO v_limit FROM public.system_config LIMIT 1;
  IF v_limit IS NULL THEN v_limit := 5; END IF;
  RETURN v_limit;
END;
$$;

-- Enforce on insert into user_pages
CREATE OR REPLACE FUNCTION public.enforce_user_page_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_count int;
BEGIN
  v_limit := public.get_effective_page_limit(NEW.user_id);
  IF v_limit < 0 THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_count FROM public.user_pages WHERE user_id = NEW.user_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Page publish limit reached (% pages). Contact admin to increase.', v_limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_page_limit ON public.user_pages;
CREATE TRIGGER trg_enforce_user_page_limit
  BEFORE INSERT ON public.user_pages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_page_limit();

-- Admin RPC: list approved users with current page limit and used count
CREATE OR REPLACE FUNCTION public.admin_get_users_with_page_limits()
RETURNS TABLE(user_id uuid, email text, nickname text, status text, page_limit integer, pages_used bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  RETURN QUERY
    SELECT p.user_id, u.email::text, p.nickname, p.status,
           pl.page_limit,
           COALESCE((SELECT COUNT(*) FROM public.user_pages up WHERE up.user_id = p.user_id), 0)
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.user_page_limits pl ON pl.user_id = p.user_id
    WHERE p.status = 'approved'
    ORDER BY p.created_at DESC;
END;
$$;

-- Admin RPC: set page limit for multiple users
CREATE OR REPLACE FUNCTION public.admin_set_page_limits(p_user_ids uuid[], p_page_limit integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  INSERT INTO public.user_page_limits (user_id, page_limit, updated_at, updated_by)
  SELECT unnest(p_user_ids), p_page_limit, now(), auth.uid()
  ON CONFLICT (user_id) DO UPDATE SET
    page_limit = EXCLUDED.page_limit,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;
END;
$$;