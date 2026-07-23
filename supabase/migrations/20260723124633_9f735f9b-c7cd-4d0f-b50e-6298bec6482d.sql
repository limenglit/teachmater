GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT SELECT ON public.boards TO anon;
GRANT ALL ON public.boards TO service_role;

-- Release AI daily-limit overrides that were installed by the 2026-07-20 backfill.
-- Any row that still equals the backfill value (3) is treated as a leftover
-- override; deleting it lets system_config.registered.ai_daily_limit take
-- effect (both client resolver and consume_ai_quota RPC fall back to it).
DELETE FROM public.user_ai_limits WHERE daily_limit = 3;