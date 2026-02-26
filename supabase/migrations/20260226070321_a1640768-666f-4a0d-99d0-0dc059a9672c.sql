CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE(user_id uuid, email text, nickname text, status text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  RETURN QUERY
    SELECT p.user_id, u.email::text, p.nickname, p.status, p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    ORDER BY p.created_at DESC;
END;
$function$;