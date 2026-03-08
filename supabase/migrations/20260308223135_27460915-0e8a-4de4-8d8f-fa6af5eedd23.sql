
-- Student points table (per-student accumulation, keyed by student name + user context)
CREATE TABLE public.student_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  description text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  creator_token text NOT NULL DEFAULT ''
);

-- Badge definitions
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  emoji text NOT NULL DEFAULT '🏅',
  description text NOT NULL DEFAULT '',
  condition_type text NOT NULL DEFAULT 'points',
  condition_value integer NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  creator_token text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false
);

-- Student earned badges
CREATE TABLE public.student_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name text NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  creator_token text NOT NULL DEFAULT ''
);

-- Enable RLS
ALTER TABLE public.student_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

-- student_points RLS
CREATE POLICY "Anyone can read points" ON public.student_points FOR SELECT USING (true);
CREATE POLICY "Anyone can add points" ON public.student_points FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny UPDATE points" ON public.student_points FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE points" ON public.student_points FOR DELETE USING (false);

-- badges RLS
CREATE POLICY "Anyone can read badges" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Anyone can create badges" ON public.badges FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny UPDATE badges" ON public.badges FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE badges" ON public.badges FOR DELETE USING (false);

-- student_badges RLS
CREATE POLICY "Anyone can read student badges" ON public.student_badges FOR SELECT USING (true);
CREATE POLICY "Anyone can award badges" ON public.student_badges FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny UPDATE student badges" ON public.student_badges FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE student badges" ON public.student_badges FOR DELETE USING (false);

-- RPC to delete a badge (token-protected)
CREATE OR REPLACE FUNCTION public.delete_badge(p_badge_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM badges WHERE id = p_badge_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM badges WHERE id = p_badge_id AND creator_token = p_token;
END;
$$;

-- RPC to delete student points record (token-protected)
CREATE OR REPLACE FUNCTION public.delete_student_points(p_point_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM student_points WHERE id = p_point_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM student_points WHERE id = p_point_id AND creator_token = p_token;
END;
$$;
