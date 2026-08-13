ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS allow_multiple_submissions boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_board_for_student(p_board_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', id,
    'title', title,
    'description', description,
    'view_mode', view_mode,
    'is_locked', is_locked,
    'is_collaborative', is_collaborative,
    'moderation_enabled', moderation_enabled,
    'allow_multiple_submissions', allow_multiple_submissions,
    'columns', columns,
    'background_color', background_color,
    'banned_words', banned_words,
    'student_names', COALESCE(student_names, '[]'::jsonb),
    'created_at', created_at
  )
  FROM public.boards
  WHERE id = p_board_id;
$function$;

DROP FUNCTION IF EXISTS public.update_board(uuid, text, text, text, text, boolean, boolean, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.update_board(
  p_board_id uuid,
  p_token text,
  p_title text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_view_mode text DEFAULT NULL::text,
  p_is_locked boolean DEFAULT NULL::boolean,
  p_moderation_enabled boolean DEFAULT NULL::boolean,
  p_columns jsonb DEFAULT NULL::jsonb,
  p_background_color text DEFAULT NULL::text,
  p_banned_words text DEFAULT NULL::text,
  p_student_names jsonb DEFAULT NULL::jsonb,
  p_allow_multiple_submissions boolean DEFAULT NULL::boolean
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    banned_words = COALESCE(p_banned_words, banned_words),
    student_names = COALESCE(p_student_names, student_names),
    allow_multiple_submissions = COALESCE(p_allow_multiple_submissions, allow_multiple_submissions)
  WHERE id = p_board_id AND creator_token = p_token;
END;
$function$;