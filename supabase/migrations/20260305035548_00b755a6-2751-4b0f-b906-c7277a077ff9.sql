
CREATE TABLE public.seat_checkin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  student_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  scene_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seat_checkin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create seat checkin sessions"
  ON public.seat_checkin_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read seat checkin sessions"
  ON public.seat_checkin_sessions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update seat checkin sessions"
  ON public.seat_checkin_sessions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.seat_checkin_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.seat_checkin_sessions(id) ON DELETE CASCADE NOT NULL,
  student_name text NOT NULL,
  checked_in_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seat_checkin_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert seat checkin records"
  ON public.seat_checkin_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read seat checkin records"
  ON public.seat_checkin_records FOR SELECT
  USING (true);
