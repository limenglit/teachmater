-- Stable RPC channel for collaborative whiteboard clients (anon-safe)

CREATE OR REPLACE FUNCTION public.list_board_strokes(p_board_id uuid, p_limit integer DEFAULT 1000)
RETURNS SETOF public.board_strokes
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT *
  FROM public.board_strokes
  WHERE board_id = p_board_id
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 1000), 5000));
$$;

CREATE OR REPLACE FUNCTION public.insert_board_stroke(
  p_board_id uuid,
  p_user_nickname text,
  p_tool text,
  p_stroke_data jsonb,
  p_color text,
  p_stroke_width numeric
)
RETURNS public.board_strokes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_row public.board_strokes;
BEGIN
  INSERT INTO public.board_strokes (
    board_id,
    user_nickname,
    tool,
    stroke_data,
    color,
    stroke_width
  ) VALUES (
    p_board_id,
    COALESCE(NULLIF(TRIM(p_user_nickname), ''), '匿名'),
    COALESCE(NULLIF(TRIM(p_tool), ''), 'pen'),
    COALESCE(p_stroke_data, '{}'::jsonb),
    COALESCE(NULLIF(TRIM(p_color), ''), '#000000'),
    COALESCE(NULLIF(p_stroke_width, 0), 2)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_board_stroke_data(
  p_stroke_id uuid,
  p_stroke_data jsonb
)
RETURNS public.board_strokes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_row public.board_strokes;
BEGIN
  UPDATE public.board_strokes
  SET stroke_data = COALESCE(p_stroke_data, '{}'::jsonb)
  WHERE id = p_stroke_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stroke not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.list_board_strokes(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_board_stroke(uuid, text, text, jsonb, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_board_stroke_data(uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_board_strokes(uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_board_stroke(uuid, text, text, jsonb, text, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_board_stroke_data(uuid, jsonb) TO anon, authenticated, service_role;
