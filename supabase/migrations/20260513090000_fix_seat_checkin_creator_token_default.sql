ALTER TABLE public.seat_checkin_sessions
ALTER COLUMN creator_token SET DEFAULT gen_random_uuid()::text;

UPDATE public.seat_checkin_sessions
SET creator_token = gen_random_uuid()::text
WHERE creator_token IS NULL OR creator_token = '';