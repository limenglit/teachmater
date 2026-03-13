-- Remove old 10-argument overload to avoid ambiguous RPC resolution.
DROP FUNCTION IF EXISTS public.update_board(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb,
  text,
  text
);

-- Keep a single canonical signature that supports student name constraints.
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
  p_banned_words text DEFAULT NULL,
  p_student_names jsonb DEFAULT NULL
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

  IF NOT EXISTS (
    SELECT 1 FROM boards WHERE id = p_board_id AND creator_token = p_token
  ) THEN
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
    banned_words = COALESCE(p_banned_words, banned_words),
    student_names = COALESCE(p_student_names, student_names)
  WHERE id = p_board_id AND creator_token = p_token;
END;
$$;
