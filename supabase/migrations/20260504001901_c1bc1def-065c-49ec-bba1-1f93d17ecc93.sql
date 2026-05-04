
-- ===== task_sessions =====
DROP POLICY IF EXISTS "Anyone can read task sessions" ON public.task_sessions;
CREATE POLICY "Owner reads task sessions"
  ON public.task_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_task_session_for_student(p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', id, 'title', title, 'status', status,
    'tasks', tasks, 'student_names', student_names
  ) FROM public.task_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.get_task_sessions_by_tokens(p_tokens text[])
RETURNS SETOF public.task_sessions LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.task_sessions
  WHERE p_tokens IS NOT NULL
    AND array_length(p_tokens, 1) > 0
    AND creator_token = ANY(p_tokens)
  ORDER BY created_at DESC;
$$;

-- ===== checkin_sessions =====
DROP POLICY IF EXISTS "Anyone can read sessions" ON public.checkin_sessions;
ALTER TABLE public.checkin_sessions ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE POLICY "Owner reads checkin sessions"
  ON public.checkin_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_checkin_session_for_student(p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', id, 'status', status, 'duration_minutes', duration_minutes,
    'created_at', created_at, 'ended_at', ended_at, 'student_names', student_names
  ) FROM public.checkin_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.get_checkin_sessions_by_tokens(p_tokens text[])
RETURNS SETOF public.checkin_sessions LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.checkin_sessions
  WHERE p_tokens IS NOT NULL
    AND array_length(p_tokens, 1) > 0
    AND creator_token = ANY(p_tokens)
  ORDER BY created_at DESC;
$$;

-- ===== seat_checkin_sessions =====
DROP POLICY IF EXISTS "Public can read active seat checkin sessions" ON public.seat_checkin_sessions;
DROP POLICY IF EXISTS "Authenticated can read all seat checkin sessions" ON public.seat_checkin_sessions;
ALTER TABLE public.seat_checkin_sessions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.seat_checkin_sessions ADD COLUMN IF NOT EXISTS creator_token text;
CREATE POLICY "Owner reads seat checkin sessions"
  ON public.seat_checkin_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_seat_checkin_session_for_student(p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', id, 'status', status, 'scene_type', scene_type,
    'scene_config', scene_config, 'seat_data', seat_data,
    'student_names', student_names, 'created_at', created_at
  ) FROM public.seat_checkin_sessions WHERE id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.get_seat_checkin_sessions_by_tokens(p_tokens text[])
RETURNS SETOF public.seat_checkin_sessions LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.seat_checkin_sessions
  WHERE p_tokens IS NOT NULL
    AND array_length(p_tokens, 1) > 0
    AND creator_token = ANY(p_tokens)
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_seat_checkin_seat_data(p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT seat_data FROM public.seat_checkin_sessions WHERE id = p_session_id;
$$;

-- ===== checkin_records =====
DROP POLICY IF EXISTS "Anyone can read records" ON public.checkin_records;
CREATE POLICY "Session owner reads checkin records"
  ON public.checkin_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checkin_sessions s
                  WHERE s.id = checkin_records.session_id AND s.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.has_checkin_record(p_session_id uuid, p_student_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.checkin_records
    WHERE session_id = p_session_id AND student_name = p_student_name
  );
$$;

CREATE OR REPLACE FUNCTION public.get_checkin_records_for_owner(p_session_id uuid, p_token text)
RETURNS SETOF public.checkin_records LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.* FROM public.checkin_records r
  WHERE r.session_id = p_session_id
    AND EXISTS (SELECT 1 FROM public.checkin_sessions s
                 WHERE s.id = p_session_id AND s.creator_token = p_token AND p_token <> '');
$$;

-- ===== seat_checkin_records =====
DROP POLICY IF EXISTS "Anyone can read seat checkin records" ON public.seat_checkin_records;
CREATE POLICY "Session owner reads seat checkin records"
  ON public.seat_checkin_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seat_checkin_sessions s
                  WHERE s.id = seat_checkin_records.session_id AND s.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.has_seat_checkin_record(p_session_id uuid, p_student_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seat_checkin_records
    WHERE session_id = p_session_id AND student_name = p_student_name
  );
$$;

CREATE OR REPLACE FUNCTION public.get_seat_checkin_guest_records(p_session_id uuid)
RETURNS TABLE(student_name text, checked_in_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_name, checked_in_at FROM public.seat_checkin_records
  WHERE session_id = p_session_id
  ORDER BY checked_in_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_seat_checkin_records_for_owner(p_session_id uuid, p_token text)
RETURNS SETOF public.seat_checkin_records LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.* FROM public.seat_checkin_records r
  WHERE r.session_id = p_session_id
    AND EXISTS (SELECT 1 FROM public.seat_checkin_sessions s
                 WHERE s.id = p_session_id AND s.creator_token = p_token AND p_token <> '');
$$;

-- ===== poll_votes =====
DROP POLICY IF EXISTS "Anyone can read poll votes" ON public.poll_votes;
CREATE POLICY "Owner reads poll votes"
  ON public.poll_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p
                  WHERE p.id = poll_votes.poll_id AND p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.get_poll_votes_for_owner(p_poll_id uuid, p_token text)
RETURNS SETOF public.poll_votes LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.* FROM public.poll_votes v
  WHERE v.poll_id = p_poll_id
    AND EXISTS (SELECT 1 FROM public.polls p
                 WHERE p.id = p_poll_id AND p.creator_token = p_token AND p_token <> '');
$$;

-- ===== Analytics aggregate (StudentAnalytics) =====
CREATE OR REPLACE FUNCTION public.get_student_checkin_counts_for_owner(
  p_student_names text[], p_from timestamptz, p_to timestamptz
)
RETURNS TABLE(student_name text, source text, c bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.student_name, 'checkin'::text AS source, count(*)::bigint
  FROM public.checkin_records r
  JOIN public.checkin_sessions s ON s.id = r.session_id
  WHERE s.user_id = auth.uid()
    AND r.checked_in_at >= p_from AND r.checked_in_at <= p_to
    AND r.student_name = ANY(p_student_names)
  GROUP BY r.student_name
  UNION ALL
  SELECT r.student_name, 'seat'::text AS source, count(*)::bigint
  FROM public.seat_checkin_records r
  JOIN public.seat_checkin_sessions s ON s.id = r.session_id
  WHERE s.user_id = auth.uid()
    AND r.checked_in_at >= p_from AND r.checked_in_at <= p_to
    AND r.student_name = ANY(p_student_names)
  GROUP BY r.student_name;
$$;

-- ===== student_badges INSERT tightening =====
DROP POLICY IF EXISTS "Authenticated users award badges" ON public.student_badges;
CREATE POLICY "Auth users award own badges"
  ON public.student_badges FOR INSERT TO authenticated
  WITH CHECK (
    creator_token <> ''
    AND EXISTS (
      SELECT 1 FROM public.badges b
      WHERE b.id = student_badges.badge_id
        AND (b.creator_token = student_badges.creator_token OR b.is_system = true)
    )
  );
