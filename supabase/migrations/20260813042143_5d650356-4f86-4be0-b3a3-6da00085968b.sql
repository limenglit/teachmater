CREATE OR REPLACE FUNCTION public.delete_own_board_card(p_board_id uuid, p_card_id uuid, p_nickname text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  IF p_nickname IS NULL OR btrim(p_nickname) = '' THEN
    RAISE EXCEPTION 'Nickname required';
  END IF;
  IF EXISTS (SELECT 1 FROM boards WHERE id = p_board_id AND is_locked) THEN
    RAISE EXCEPTION 'Board is locked';
  END IF;
  DELETE FROM board_cards
   WHERE id = p_card_id
     AND board_id = p_board_id
     AND author_nickname = btrim(p_nickname);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_own_board_card(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_board_card(uuid, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_board_cards(p_board_id uuid, p_nickname text)
RETURNS TABLE (
  id uuid,
  content text,
  card_type text,
  media_url text,
  url text,
  column_id text,
  is_approved boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.content, c.card_type, c.media_url, c.url, c.column_id, c.is_approved, c.created_at
  FROM public.board_cards c
  WHERE c.board_id = p_board_id
    AND c.author_nickname = btrim(COALESCE(p_nickname, ''))
    AND btrim(COALESCE(p_nickname, '')) <> ''
  ORDER BY c.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_my_board_cards(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_board_cards(uuid, text) TO anon, authenticated;