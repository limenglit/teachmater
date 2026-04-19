-- Cloud storage for seat layout history (all 6 scenes)
CREATE TABLE public.seat_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  scene_type text NOT NULL,
  name text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own seat history"
ON public.seat_history
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_seat_history_user_scene ON public.seat_history(user_id, scene_type, created_at DESC);