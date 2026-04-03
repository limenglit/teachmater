-- Track per-user AI usage per feature/day and enforce configurable limits.

CREATE TABLE public.user_ai_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  usage_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature, usage_date)
);

ALTER TABLE public.user_ai_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own AI usage" ON public.user_ai_usage_daily
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI usage" ON public.user_ai_usage_daily
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI usage" ON public.user_ai_usage_daily
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read AI usage" ON public.user_ai_usage_daily
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_effective_ai_daily_limit(p_feature text DEFAULT 'sketch')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer;
  v_config jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Admins are always unlimited.
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN -1;
  END IF;

  SELECT l.daily_limit
    INTO v_limit
  FROM public.user_ai_limits l
  WHERE l.user_id = auth.uid();

  IF v_limit IS NOT NULL THEN
    RETURN v_limit;
  END IF;

  SELECT sc.config
    INTO v_config
  FROM public.system_config sc
  LIMIT 1;

  IF v_config ? 'registered' THEN
    RETURN COALESCE((v_config->'registered'->>'ai_daily_limit')::integer, -1);
  END IF;

  RETURN -1;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_feature text DEFAULT 'sketch')
RETURNS TABLE(allowed boolean, limit_value integer, used integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer;
  v_used integer;
  v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_limit := public.get_effective_ai_daily_limit(p_feature);

  IF v_limit = -1 THEN
    RETURN QUERY SELECT true, v_limit, 0;
    RETURN;
  END IF;

  INSERT INTO public.user_ai_usage_daily (user_id, feature, usage_date, usage_count, updated_at)
  VALUES (auth.uid(), p_feature, v_today, 0, now())
  ON CONFLICT (user_id, feature, usage_date) DO NOTHING;

  UPDATE public.user_ai_usage_daily
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE user_id = auth.uid()
    AND feature = p_feature
    AND usage_date = v_today
    AND usage_count < v_limit
  RETURNING usage_count INTO v_used;

  IF v_used IS NULL THEN
    SELECT usage_count
      INTO v_used
    FROM public.user_ai_usage_daily
    WHERE user_id = auth.uid()
      AND feature = p_feature
      AND usage_date = v_today;

    RETURN QUERY SELECT false, v_limit, COALESCE(v_used, 0);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_limit, v_used;
END;
$$;
