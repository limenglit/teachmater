DROP POLICY IF EXISTS "Anyone can read task completions" ON public.task_completions;
REVOKE SELECT ON TABLE public.task_completions FROM anon;
REVOKE SELECT ON TABLE public.task_completions FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_task_completions_for_owner(p_session_id uuid, p_token text DEFAULT NULL)
RETURNS SETOF public.task_completions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.task_completions c
  WHERE c.session_id = p_session_id
    AND EXISTS (
      SELECT 1 FROM public.task_sessions s
      WHERE s.id = p_session_id
        AND ((auth.uid() IS NOT NULL AND s.user_id = auth.uid())
             OR (p_token IS NOT NULL AND p_token <> '' AND s.creator_token = p_token))
    )
  ORDER BY c.completed_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_task_completion_indexes_for_student(p_session_id uuid, p_student_name text)
RETURNS TABLE(task_index integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.task_index
  FROM public.task_completions c
  JOIN public.task_sessions s ON s.id = c.session_id
  WHERE c.session_id = p_session_id
    AND s.status = 'active'
    AND c.student_name = trim(p_student_name)
    AND trim(COALESCE(p_student_name, '')) <> ''
    AND (
      s.student_names IS NULL
      OR jsonb_typeof(s.student_names) <> 'array'
      OR jsonb_array_length(s.student_names) = 0
      OR s.student_names @> to_jsonb(trim(p_student_name))
    )
  ORDER BY c.task_index;
$$;

CREATE OR REPLACE FUNCTION public.get_task_completion_counts_for_owner(p_student_names text[], p_from timestamptz, p_to timestamptz)
RETURNS TABLE(student_name text, c bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.student_name, count(*)::bigint
  FROM public.task_completions c
  JOIN public.task_sessions s ON s.id = c.session_id
  WHERE auth.uid() IS NOT NULL
    AND s.user_id = auth.uid()
    AND c.completed_at >= p_from
    AND c.completed_at <= p_to
    AND c.student_name = ANY(p_student_names)
  GROUP BY c.student_name;
$$;

REVOKE ALL ON FUNCTION public.get_task_completions_for_owner(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_task_completion_indexes_for_student(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_task_completion_counts_for_owner(text[], timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_task_completions_for_owner(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_task_completion_indexes_for_student(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_task_completion_counts_for_owner(text[], timestamptz, timestamptz) TO authenticated;

DROP POLICY IF EXISTS "Deny direct DELETE seat_checkin_sessions" ON public.seat_checkin_sessions;
CREATE POLICY "Deny direct DELETE seat_checkin_sessions"
ON public.seat_checkin_sessions
FOR DELETE
TO public
USING (false);