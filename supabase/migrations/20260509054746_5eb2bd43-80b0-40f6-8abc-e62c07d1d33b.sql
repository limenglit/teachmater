CREATE OR REPLACE FUNCTION public.get_board_for_student(p_board_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id,
    'title', title,
    'description', description,
    'view_mode', view_mode,
    'is_locked', is_locked,
    'is_collaborative', is_collaborative,
    'moderation_enabled', moderation_enabled,
    'columns', columns,
    'background_color', background_color,
    'banned_words', banned_words,
    'student_names', COALESCE(student_names, '[]'::jsonb),
    'created_at', created_at
  )
  FROM public.boards
  WHERE id = p_board_id;
$$;