
-- Auto-assign admin role and approved status for the developer email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    CASE WHEN NEW.email = 'icelm@sina.com' THEN 'approved' ELSE 'pending' END
  );
  -- Auto-assign admin role for developer
  IF NEW.email = 'icelm@sina.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;
