
-- ============================================================
-- Creative Board: boards table
-- ============================================================
CREATE TABLE public.boards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  creator_token text NOT NULL DEFAULT (gen_random_uuid())::text,
  view_mode text NOT NULL DEFAULT 'wall',
  is_locked boolean NOT NULL DEFAULT false,
  moderation_enabled boolean NOT NULL DEFAULT false,
  columns jsonb NOT NULL DEFAULT '["待办","进行中","已完成"]'::jsonb,
  background_color text NOT NULL DEFAULT '#ffffff',
  banned_words text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read boards" ON public.boards FOR SELECT USING (true);
CREATE POLICY "Anyone can create boards" ON public.boards FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny direct UPDATE" ON public.boards FOR UPDATE USING (false);
CREATE POLICY "Deny direct DELETE" ON public.boards FOR DELETE USING (false);

-- ============================================================
-- Creative Board: board_cards table
-- ============================================================
CREATE TABLE public.board_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  card_type text NOT NULL DEFAULT 'text',
  media_url text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#ffffff',
  author_nickname text NOT NULL DEFAULT '匿名',
  is_pinned boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT true,
  likes_count integer NOT NULL DEFAULT 0,
  column_id text NOT NULL DEFAULT '',
  position_x double precision NOT NULL DEFAULT 0,
  position_y double precision NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.board_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved cards" ON public.board_cards FOR SELECT USING (true);
CREATE POLICY "Anyone can create cards" ON public.board_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny direct UPDATE on cards" ON public.board_cards FOR UPDATE USING (false);
CREATE POLICY "Deny direct DELETE on cards" ON public.board_cards FOR DELETE USING (false);

-- ============================================================
-- Creative Board: board_comments table
-- ============================================================
CREATE TABLE public.board_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES public.board_cards(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  author_nickname text NOT NULL DEFAULT '匿名',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments" ON public.board_comments FOR SELECT USING (true);
CREATE POLICY "Anyone can create comments" ON public.board_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny UPDATE comments" ON public.board_comments FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE comments" ON public.board_comments FOR DELETE USING (false);

-- ============================================================
-- Creative Board: board_likes table (dedup by session)
-- ============================================================
CREATE TABLE public.board_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES public.board_cards(id) ON DELETE CASCADE,
  liker_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id, liker_token)
);

ALTER TABLE public.board_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes" ON public.board_likes FOR SELECT USING (true);
CREATE POLICY "Anyone can like" ON public.board_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny UPDATE likes" ON public.board_likes FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE likes" ON public.board_likes FOR DELETE USING (false);

-- ============================================================
-- Enable Realtime for board_cards and board_comments
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_comments;

-- ============================================================
-- Security Definer functions for board management (creator_token auth)
-- ============================================================

-- Update board settings
CREATE OR REPLACE FUNCTION public.update_board(
  p_board_id uuid,
  p_token text,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_view_mode text DEFAULT NULL,
  p_is_locked boolean DEFAULT NULL,
  p_moderation_enabled boolean DEFAULT NULL,
  p_columns jsonb DEFAULT NULL,
  p_background_color text DEFAULT NULL,
  p_banned_words text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM boards WHERE id = p_board_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized or board not found';
  END IF;
  UPDATE boards SET
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    view_mode = COALESCE(p_view_mode, view_mode),
    is_locked = COALESCE(p_is_locked, is_locked),
    moderation_enabled = COALESCE(p_moderation_enabled, moderation_enabled),
    columns = COALESCE(p_columns, columns),
    background_color = COALESCE(p_background_color, background_color),
    banned_words = COALESCE(p_banned_words, banned_words)
  WHERE id = p_board_id AND creator_token = p_token;
END;
$$;

-- Delete board
CREATE OR REPLACE FUNCTION public.delete_board(p_board_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM boards WHERE id = p_board_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized or board not found';
  END IF;
  DELETE FROM boards WHERE id = p_board_id AND creator_token = p_token;
END;
$$;

-- Manage card (approve, pin, delete) by board creator
CREATE OR REPLACE FUNCTION public.manage_board_card(
  p_board_id uuid,
  p_token text,
  p_card_id uuid,
  p_action text  -- 'approve', 'reject', 'pin', 'unpin', 'delete'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM boards WHERE id = p_board_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_action = 'approve' THEN
    UPDATE board_cards SET is_approved = true WHERE id = p_card_id AND board_id = p_board_id;
  ELSIF p_action = 'reject' THEN
    DELETE FROM board_cards WHERE id = p_card_id AND board_id = p_board_id;
  ELSIF p_action = 'pin' THEN
    UPDATE board_cards SET is_pinned = true WHERE id = p_card_id AND board_id = p_board_id;
  ELSIF p_action = 'unpin' THEN
    UPDATE board_cards SET is_pinned = false WHERE id = p_card_id AND board_id = p_board_id;
  ELSIF p_action = 'delete' THEN
    DELETE FROM board_cards WHERE id = p_card_id AND board_id = p_board_id;
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;
END;
$$;

-- Increment likes_count via trigger
CREATE OR REPLACE FUNCTION public.update_card_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE board_cards SET likes_count = likes_count + 1 WHERE id = NEW.card_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_board_like_insert
  AFTER INSERT ON public.board_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_card_likes_count();
