ALTER FUNCTION public.create_checkin_session(integer, jsonb) SECURITY DEFINER;
ALTER FUNCTION public.create_seat_checkin_session(jsonb, jsonb, jsonb, text, integer, text, boolean, integer) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.create_checkin_session(integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_seat_checkin_session(jsonb, jsonb, jsonb, text, integer, text, boolean, integer) TO anon, authenticated;