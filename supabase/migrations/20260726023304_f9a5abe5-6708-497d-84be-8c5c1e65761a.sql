DROP FUNCTION IF EXISTS public.get_public_page(text, text);
CREATE OR REPLACE FUNCTION public.get_public_page(p_username text, p_slug text)
 RETURNS TABLE(title text, html_content text, storage_path text, updated_at timestamp with time zone, user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT title, html_content, storage_path, updated_at, user_id
  FROM public.user_pages
  WHERE LOWER(username) = LOWER(p_username) AND LOWER(slug) = LOWER(p_slug) AND is_public = true
  LIMIT 1;
$function$;