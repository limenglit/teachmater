REVOKE EXECUTE ON FUNCTION public.enforce_owned_class_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_content_class(text, uuid, uuid) FROM PUBLIC, anon;