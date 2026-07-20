
-- 1) 让新注册用户不再写入 user_ai_limits, 从而后台配置的默认值 (system_config.registered.ai_daily_limit) 可以即时生效
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
  END IF;
  -- NOTE: 不再插入 user_ai_limits, 默认配额改由 system_config.registered.ai_daily_limit 动态提供
  RETURN NEW;
END;
$function$;

-- 2) 确保 system_config 中已配置 registered.ai_daily_limit = 3 (若尚未设置)
INSERT INTO public.system_config (id, config)
SELECT gen_random_uuid(),
       jsonb_build_object('registered', jsonb_build_object('ai_daily_limit', 3))
WHERE NOT EXISTS (SELECT 1 FROM public.system_config);

UPDATE public.system_config
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{registered,ai_daily_limit}',
  to_jsonb(3),
  true
)
WHERE (config->'registered'->>'ai_daily_limit') IS NULL
   OR (config->'registered'->>'ai_daily_limit')::int = -1;
