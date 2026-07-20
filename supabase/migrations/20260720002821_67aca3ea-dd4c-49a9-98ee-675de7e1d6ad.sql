
-- 1) Update handle_new_user to auto-provision default AI daily limit (3) for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nickname, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    CASE WHEN NEW.email = 'icelm@sina.com' THEN 'approved' ELSE 'pending' END
  );
  IF NEW.email = 'icelm@sina.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    -- Default AI quota for every new registered user: 3 / day
    INSERT INTO public.user_ai_limits (user_id, daily_limit, updated_at)
    VALUES (NEW.id, 3, now())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Backfill: any existing non-admin user without a per-user limit gets 3/day
INSERT INTO public.user_ai_limits (user_id, daily_limit, updated_at)
SELECT p.user_id, 3, now()
FROM public.profiles p
LEFT JOIN public.user_ai_limits l ON l.user_id = p.user_id
WHERE l.user_id IS NULL
  AND NOT public.has_role(p.user_id, 'admin')
ON CONFLICT (user_id) DO NOTHING;
