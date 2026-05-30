
ALTER TABLE public.user_pages ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.user_pages ALTER COLUMN html_content DROP NOT NULL;
DROP FUNCTION IF EXISTS public.get_public_page(text, text);
CREATE FUNCTION public.get_public_page(p_username text, p_slug text)
 RETURNS TABLE(title text, html_content text, storage_path text, updated_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT title, html_content, storage_path, updated_at
  FROM public.user_pages
  WHERE LOWER(username) = LOWER(p_username) AND LOWER(slug) = LOWER(p_slug) AND is_public = true
  LIMIT 1;
$$;
