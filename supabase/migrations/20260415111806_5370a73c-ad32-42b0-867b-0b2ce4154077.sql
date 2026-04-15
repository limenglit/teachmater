
CREATE TABLE public.teamwork_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL DEFAULT 'teams',
  title text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  student_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
);

ALTER TABLE public.teamwork_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read teamwork sessions" ON public.teamwork_sessions FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create teamwork sessions" ON public.teamwork_sessions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Deny UPDATE teamwork_sessions" ON public.teamwork_sessions FOR UPDATE TO public USING (false);
CREATE POLICY "Deny DELETE teamwork_sessions" ON public.teamwork_sessions FOR DELETE TO public USING (false);
