
-- System feature configuration table (single row, admin-managed)
CREATE TABLE public.system_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config jsonb NOT NULL DEFAULT '{
    "guest": {
      "random": true,
      "teamwork": true,
      "seats": true,
      "board": true,
      "quiz": true,
      "sketch": true,
      "ppt": true,
      "visual": true,
      "achieve": true,
      "toolkit": true,
      "ai_daily_limit": 5
    },
    "registered": {
      "random": true,
      "teamwork": true,
      "seats": true,
      "board": true,
      "quiz": true,
      "sketch": true,
      "ppt": true,
      "visual": true,
      "achieve": true,
      "toolkit": true,
      "ai_daily_limit": -1
    }
  }'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config
CREATE POLICY "Anyone can read system config"
  ON public.system_config FOR SELECT
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update system config"
  ON public.system_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert
CREATE POLICY "Admins can insert system config"
  ON public.system_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default row
INSERT INTO public.system_config (config) VALUES ('{
  "guest": {
    "random": true,
    "teamwork": true,
    "seats": true,
    "board": true,
    "quiz": true,
    "sketch": true,
    "ppt": true,
    "visual": true,
    "achieve": true,
    "toolkit": true,
    "ai_daily_limit": 5
  },
  "registered": {
    "random": true,
    "teamwork": true,
    "seats": true,
    "board": true,
    "quiz": true,
    "sketch": true,
    "ppt": true,
    "visual": true,
    "achieve": true,
    "toolkit": true,
    "ai_daily_limit": -1
  }
}'::jsonb);
