
-- Add is_collaborative flag to boards
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS is_collaborative boolean NOT NULL DEFAULT false;

-- Create board_strokes table for real-time collaborative drawing
CREATE TABLE public.board_strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_nickname text NOT NULL DEFAULT '匿名',
  tool text NOT NULL DEFAULT 'pen',
  stroke_data jsonb NOT NULL DEFAULT '{}',
  color text NOT NULL DEFAULT '#000000',
  stroke_width numeric NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_board_strokes_board_id ON public.board_strokes(board_id);

-- Enable RLS
ALTER TABLE public.board_strokes ENABLE ROW LEVEL SECURITY;

-- Anyone can read strokes (collaborative boards are public)
CREATE POLICY "Anyone can read strokes" ON public.board_strokes
  FOR SELECT TO public USING (true);

-- Anyone can insert strokes (students join via QR)
CREATE POLICY "Anyone can insert strokes" ON public.board_strokes
  FOR INSERT TO public WITH CHECK (true);

-- Deny direct update/delete (managed by board owner via RPC)
CREATE POLICY "Deny UPDATE strokes" ON public.board_strokes
  FOR UPDATE TO public USING (false);

CREATE POLICY "Deny DELETE strokes" ON public.board_strokes
  FOR DELETE TO public USING (false);

-- RPC: clear all strokes (teacher only)
CREATE OR REPLACE FUNCTION public.clear_board_strokes(p_board_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM boards WHERE id = p_board_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM board_strokes WHERE board_id = p_board_id;
END;
$$;

-- RPC: delete single stroke (teacher only)
CREATE OR REPLACE FUNCTION public.delete_board_stroke(p_board_id uuid, p_token text, p_stroke_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM boards WHERE id = p_board_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM board_strokes WHERE id = p_stroke_id AND board_id = p_board_id;
END;
$$;

-- Enable realtime for board_strokes
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_strokes;
