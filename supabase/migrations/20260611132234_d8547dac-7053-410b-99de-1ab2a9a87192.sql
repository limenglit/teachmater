REVOKE SELECT ON TABLE public.badges FROM anon;
GRANT SELECT (id, name, emoji, description, condition_type, condition_value, created_at, is_system) ON public.badges TO anon;