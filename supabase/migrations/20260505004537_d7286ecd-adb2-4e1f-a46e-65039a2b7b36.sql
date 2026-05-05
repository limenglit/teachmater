
-- 1) ppt-images: restrict uploads to authenticated users
DROP POLICY IF EXISTS "Public upload ppt-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload ppt images" ON storage.objects;
DROP POLICY IF EXISTS "Public ppt images upload" ON storage.objects;
CREATE POLICY "Auth users upload ppt-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ppt-images');

-- 2) Quiz: roster validation + duplicate guard inside RPC
CREATE OR REPLACE FUNCTION public.submit_quiz_answers(p_session_id uuid, p_student_name text, p_answers jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  session_record RECORD;
  q jsonb;
  i int;
  student_answer jsonb;
  correct jsonb;
  is_correct boolean;
  q_type text;
  trimmed_name text;
BEGIN
  SELECT * INTO session_record FROM quiz_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF session_record.status <> 'active' THEN RAISE EXCEPTION 'Session is not active'; END IF;
  IF p_student_name IS NULL OR trim(p_student_name) = '' THEN
    RAISE EXCEPTION 'Student name is required';
  END IF;
  trimmed_name := trim(p_student_name);

  IF session_record.student_names IS NOT NULL
     AND jsonb_typeof(session_record.student_names) = 'array'
     AND jsonb_array_length(session_record.student_names) > 0
     AND NOT (session_record.student_names @> to_jsonb(trimmed_name)) THEN
    RAISE EXCEPTION 'Student name not found in session roster';
  END IF;

  IF EXISTS (SELECT 1 FROM quiz_answers WHERE session_id = p_session_id AND student_name = trimmed_name) THEN
    RAISE EXCEPTION 'Already submitted';
  END IF;

  i := 0;
  FOR q IN SELECT * FROM jsonb_array_elements(session_record.questions)
  LOOP
    student_answer := p_answers->i;
    correct := q->'correct_answer';
    q_type := q->>'type';
    is_correct := NULL;

    IF q_type IN ('single', 'tf') THEN
      is_correct := (student_answer = correct);
    ELSIF q_type = 'multi' THEN
      is_correct := (
        (SELECT jsonb_agg(v ORDER BY v) FROM jsonb_array_elements_text(COALESCE(student_answer, '[]'::jsonb)) v) =
        (SELECT jsonb_agg(v ORDER BY v) FROM jsonb_array_elements_text(COALESCE(correct, '[]'::jsonb)) v)
      );
    END IF;

    INSERT INTO quiz_answers (session_id, student_name, question_index, answer, is_correct)
    VALUES (p_session_id, trimmed_name, i, COALESCE(student_answer, '""'::jsonb), is_correct);

    i := i + 1;
  END LOOP;
END;
$function$;

-- 3) teamwork_sessions: restrict public reads, add public RPC for student lookup
DROP POLICY IF EXISTS "Anyone can read teamwork sessions" ON public.teamwork_sessions;

CREATE POLICY "Auth users read teamwork sessions"
  ON public.teamwork_sessions FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.get_teamwork_session_for_student(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', id, 'title', title, 'type', type, 'data', data
  ) FROM public.teamwork_sessions WHERE id = p_session_id;
$function$;

-- 4) student_points: require ownership via user_id
ALTER TABLE public.student_points
  ADD COLUMN IF NOT EXISTS user_id uuid;

DROP POLICY IF EXISTS "Authenticated users add points with token" ON public.student_points;
CREATE POLICY "Auth users insert own points"
  ON public.student_points FOR INSERT TO authenticated
  WITH CHECK (
    creator_token IS NOT NULL AND creator_token <> ''
    AND user_id = auth.uid()
  );

-- 5) AI quota tracking
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  used_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, used_on)
);
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own ai usage" ON public.ai_usage_log;
CREATE POLICY "Users read own ai usage"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit int;
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_count int;
BEGIN
  IF public.has_role(p_user_id, 'admin') THEN RETURN true; END IF;

  SELECT daily_limit INTO v_limit FROM public.user_ai_limits WHERE user_id = p_user_id;
  IF v_limit IS NULL THEN
    SELECT COALESCE((config->'registered'->>'ai_daily_limit')::int, -1)
      INTO v_limit FROM public.system_config LIMIT 1;
  END IF;
  IF v_limit IS NULL THEN v_limit := -1; END IF;
  IF v_limit < 0 THEN RETURN true; END IF;

  INSERT INTO public.ai_usage_log (user_id, used_on, count)
    VALUES (p_user_id, v_today, 1)
    ON CONFLICT (user_id, used_on)
      DO UPDATE SET count = ai_usage_log.count + 1, updated_at = now()
    RETURNING count INTO v_count;

  IF v_count > v_limit THEN
    UPDATE public.ai_usage_log SET count = count - 1, updated_at = now()
      WHERE user_id = p_user_id AND used_on = v_today;
    RETURN false;
  END IF;
  RETURN true;
END;
$function$;
