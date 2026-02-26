
-- Check-in sessions table
CREATE TABLE public.checkin_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_minutes INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active',
  ended_at TIMESTAMP WITH TIME ZONE,
  creator_token TEXT NOT NULL DEFAULT gen_random_uuid()::text
);

-- Check-in records table
CREATE TABLE public.checkin_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.checkin_sessions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'matched'
);

-- Enable RLS but allow all access (public feature, no auth)
ALTER TABLE public.checkin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to checkin_sessions" ON public.checkin_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to checkin_records" ON public.checkin_records FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkin_records;
