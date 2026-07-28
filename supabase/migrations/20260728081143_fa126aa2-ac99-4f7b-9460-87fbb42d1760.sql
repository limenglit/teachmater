CREATE TABLE public.ai_image_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  prompt text NOT NULL DEFAULT '',
  doc_text text NOT NULL DEFAULT '',
  chart_type text NOT NULL DEFAULT '',
  sub_style text NOT NULL DEFAULT '',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_image_history TO authenticated;
GRANT ALL ON public.ai_image_history TO service_role;

ALTER TABLE public.ai_image_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own AI image history"
ON public.ai_image_history FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX ai_image_history_user_created_idx ON public.ai_image_history (user_id, created_at DESC);