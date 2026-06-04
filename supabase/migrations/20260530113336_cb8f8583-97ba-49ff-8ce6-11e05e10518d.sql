-- Restrict creator_token column from anonymous SELECT on public-facing tables
-- Authenticated owners retain SELECT for their owner panels; service_role unaffected.

-- BOARDS
REVOKE SELECT ON public.boards FROM anon;
GRANT SELECT (
  id, title, description, view_mode, is_locked, is_collaborative,
  moderation_enabled, columns, background_color, banned_words,
  student_names, user_id, created_at
) ON public.boards TO anon;

-- POLLS
REVOKE SELECT ON public.polls FROM anon;
GRANT SELECT (
  id, title, poll_type, options, status, user_id, created_at, ended_at
) ON public.polls TO anon;

-- DISCUSSION_TOPICS
REVOKE SELECT ON public.discussion_topics FROM anon;
GRANT SELECT (
  id, title, student_names, created_at
) ON public.discussion_topics TO anon;