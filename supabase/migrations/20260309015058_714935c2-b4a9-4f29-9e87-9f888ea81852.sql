-- Table to store group/team history
CREATE TABLE public.teamwork_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'groups', -- 'groups' or 'teams'
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  student_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teamwork_history ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only manage their own history
CREATE POLICY "Users manage own teamwork history"
  ON public.teamwork_history
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());