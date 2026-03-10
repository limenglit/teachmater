
-- Task sessions table
CREATE TABLE public.task_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  student_names jsonb DEFAULT '[]'::jsonb,
  creator_token text NOT NULL DEFAULT (gen_random_uuid())::text,
  status text NOT NULL DEFAULT 'active',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create task sessions" ON public.task_sessions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can read task sessions" ON public.task_sessions FOR SELECT TO public USING (true);
CREATE POLICY "Deny direct UPDATE task_sessions" ON public.task_sessions FOR UPDATE TO public USING (false);
CREATE POLICY "Deny direct DELETE task_sessions" ON public.task_sessions FOR DELETE TO public USING (false);

-- Task completions table
CREATE TABLE public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.task_sessions(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  task_index integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read task completions" ON public.task_completions FOR SELECT TO public USING (true);
CREATE POLICY "Insert to active task sessions only" ON public.task_completions FOR INSERT TO public WITH CHECK (
  EXISTS (SELECT 1 FROM task_sessions WHERE task_sessions.id = task_completions.session_id AND task_sessions.status = 'active')
);
CREATE POLICY "Deny UPDATE task completions" ON public.task_completions FOR UPDATE TO public USING (false);
CREATE POLICY "Deny DELETE task completions" ON public.task_completions FOR DELETE TO public USING (false);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_completions;

-- RPC to update task session (end/save)
CREATE OR REPLACE FUNCTION public.update_task_session(p_session_id uuid, p_token text, p_status text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM task_sessions WHERE id = p_session_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE task_sessions SET status = COALESCE(p_status, status) WHERE id = p_session_id AND creator_token = p_token;
END;
$$;
