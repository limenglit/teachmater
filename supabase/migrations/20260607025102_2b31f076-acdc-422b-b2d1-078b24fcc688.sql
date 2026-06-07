REVOKE SELECT (creator_token) ON public.badges FROM anon;
REVOKE SELECT (creator_token) ON public.discussion_topics FROM anon;

-- Re-grant SELECT on all other columns so anon reads continue working.
GRANT SELECT (id, name, emoji, description, condition_type, condition_value, is_system, created_at)
  ON public.badges TO anon;
GRANT SELECT (id, title, created_at)
  ON public.discussion_topics TO anon;