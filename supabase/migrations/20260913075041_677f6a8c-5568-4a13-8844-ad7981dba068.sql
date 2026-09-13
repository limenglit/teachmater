-- 1) Board card ownership token (hash only; raw token stays on the client)
ALTER TABLE public.board_cards
  ADD COLUMN IF NOT EXISTS author_token_hash text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.delete_own_board_card(p_board_id uuid, p_card_id uuid, p_nickname text, p_token_hash text DEFAULT '')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
  v_hash text := btrim(COALESCE(p_token_hash, ''));
BEGIN
  IF p_nickname IS NULL OR btrim(p_nickname) = '' THEN
    RAISE EXCEPTION 'Nickname required';
  END IF;
  IF v_hash = '' THEN
    RAISE EXCEPTION 'Ownership token required';
  END IF;
  IF EXISTS (SELECT 1 FROM boards WHERE id = p_board_id AND is_locked) THEN
    RAISE EXCEPTION 'Board is locked';
  END IF;
  DELETE FROM board_cards
   WHERE id = p_card_id
     AND board_id = p_board_id
     AND author_nickname = btrim(p_nickname)
     AND author_token_hash = v_hash;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$function$;

DROP FUNCTION IF EXISTS public.delete_own_board_card(uuid, uuid, text);

REVOKE ALL ON FUNCTION public.delete_own_board_card(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_board_card(uuid, uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_board_cards(p_board_id uuid, p_nickname text, p_token_hash text DEFAULT '')
RETURNS TABLE (
  id uuid,
  content text,
  card_type text,
  media_url text,
  url text,
  column_id text,
  is_approved boolean,
  created_at timestamptz,
  can_delete boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.content, c.card_type, c.media_url, c.url, c.column_id, c.is_approved, c.created_at,
         (c.author_token_hash <> '' AND c.author_token_hash = btrim(COALESCE(p_token_hash, ''))) AS can_delete
  FROM public.board_cards c
  WHERE c.board_id = p_board_id
    AND c.author_nickname = btrim(COALESCE(p_nickname, ''))
    AND btrim(COALESCE(p_nickname, '')) <> ''
  ORDER BY c.created_at DESC;
$function$;

DROP FUNCTION IF EXISTS public.get_my_board_cards(uuid, text);

REVOKE ALL ON FUNCTION public.get_my_board_cards(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_board_cards(uuid, text, text) TO anon, authenticated;

-- 2) system_config: no more public read of internal infra config
DROP POLICY IF EXISTS "Anyone can read system config" ON public.system_config;

CREATE POLICY "Admins can read system config"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_public_system_config()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT jsonb_strip_nulls(jsonb_build_object(
       'guest', c.config->'guest',
       'registered', c.config->'registered',
       'checkinPolicy', c.config->'checkinPolicy',
       'toolkitTools', c.config->'toolkitTools',
       'paymentQR', c.config->'paymentQR'
     ))
     FROM public.system_config c
     ORDER BY c.id
     LIMIT 1),
    '{}'::jsonb);
$function$;

REVOKE ALL ON FUNCTION public.get_public_system_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_system_config() TO anon, authenticated, service_role;