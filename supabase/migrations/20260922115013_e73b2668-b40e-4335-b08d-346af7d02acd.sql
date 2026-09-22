-- Keep the per-submitter delete credential out of any client-readable table.
CREATE TABLE IF NOT EXISTS public.board_card_tokens (
  card_id uuid PRIMARY KEY REFERENCES public.board_cards(id) ON DELETE CASCADE,
  token_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.board_card_tokens TO service_role;
ALTER TABLE public.board_card_tokens ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only security-definer functions may touch this table.

INSERT INTO public.board_card_tokens (card_id, token_hash)
SELECT id, author_token_hash FROM public.board_cards
WHERE COALESCE(author_token_hash, '') <> ''
ON CONFLICT (card_id) DO NOTHING;

UPDATE public.board_cards SET author_token_hash = '' WHERE COALESCE(author_token_hash, '') <> '';

CREATE OR REPLACE FUNCTION public.move_board_card_token()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.author_token_hash, '') <> '' THEN
    INSERT INTO public.board_card_tokens (card_id, token_hash)
    VALUES (NEW.id, NEW.author_token_hash)
    ON CONFLICT (card_id) DO UPDATE SET token_hash = EXCLUDED.token_hash;

    UPDATE public.board_cards SET author_token_hash = '' WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS board_cards_move_token ON public.board_cards;
CREATE TRIGGER board_cards_move_token
AFTER INSERT ON public.board_cards
FOR EACH ROW EXECUTE FUNCTION public.move_board_card_token();

-- Ownership checks now read the private table.
CREATE OR REPLACE FUNCTION public.delete_own_board_card(p_board_id uuid, p_card_id uuid, p_nickname text, p_token_hash text DEFAULT ''::text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  DELETE FROM board_cards c
   WHERE c.id = p_card_id
     AND c.board_id = p_board_id
     AND c.author_nickname = btrim(p_nickname)
     AND EXISTS (
       SELECT 1 FROM public.board_card_tokens t
       WHERE t.card_id = c.id AND t.token_hash = v_hash
     );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_board_cards(p_board_id uuid, p_nickname text, p_token_hash text DEFAULT ''::text)
RETURNS TABLE(id uuid, content text, card_type text, media_url text, url text, column_id text, is_approved boolean, created_at timestamptz, can_delete boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.content, c.card_type, c.media_url, c.url, c.column_id, c.is_approved, c.created_at,
         EXISTS (
           SELECT 1 FROM public.board_card_tokens t
           WHERE t.card_id = c.id
             AND t.token_hash <> ''
             AND t.token_hash = btrim(COALESCE(p_token_hash, ''))
         ) AS can_delete
  FROM public.board_cards c
  WHERE c.board_id = p_board_id
    AND c.author_nickname = btrim(COALESCE(p_nickname, ''))
    AND btrim(COALESCE(p_nickname, '')) <> ''
  ORDER BY c.created_at DESC;
$$;