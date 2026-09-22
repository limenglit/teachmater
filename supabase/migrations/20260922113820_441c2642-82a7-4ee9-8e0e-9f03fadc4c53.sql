-- Helper lookups (security definer so guest visitors can be validated without
-- exposing the underlying rows).
CREATE OR REPLACE FUNCTION public.board_exists(p_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.boards b WHERE b.id = p_board_id);
$$;

CREATE OR REPLACE FUNCTION public.board_is_open(p_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = p_board_id AND COALESCE(b.is_locked, false) = false
  );
$$;

CREATE OR REPLACE FUNCTION public.card_exists(p_card_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.board_cards c WHERE c.id = p_card_id);
$$;

CREATE OR REPLACE FUNCTION public.card_board_is_open(p_card_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_cards c
    JOIN public.boards b ON b.id = c.board_id
    WHERE c.id = p_card_id AND COALESCE(b.is_locked, false) = false
  );
$$;

CREATE OR REPLACE FUNCTION public.card_board_owner(p_card_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.user_id FROM public.board_cards c
  JOIN public.boards b ON b.id = c.board_id
  WHERE c.id = p_card_id;
$$;

CREATE OR REPLACE FUNCTION public.poll_is_active(p_poll_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.polls p WHERE p.id = p_poll_id AND p.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.topic_exists(p_topic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.discussion_topics t WHERE t.id = p_topic_id);
$$;

GRANT EXECUTE ON FUNCTION public.board_exists(uuid), public.board_is_open(uuid),
  public.card_exists(uuid), public.card_board_is_open(uuid), public.card_board_owner(uuid),
  public.poll_is_active(uuid), public.topic_exists(uuid) TO anon, authenticated, service_role;

-- board_strokes -------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read strokes" ON public.board_strokes;
CREATE POLICY "Strokes readable for existing boards" ON public.board_strokes
  FOR SELECT USING (public.board_exists(board_id));

DROP POLICY IF EXISTS "Anyone can insert strokes" ON public.board_strokes;
CREATE POLICY "Strokes insertable on open boards" ON public.board_strokes
  FOR INSERT WITH CHECK (public.board_is_open(board_id));

-- board_cards ---------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read approved cards" ON public.board_cards;
CREATE POLICY "Cards readable for existing boards" ON public.board_cards
  FOR SELECT USING (public.board_exists(board_id));

DROP POLICY IF EXISTS "Anyone can create cards" ON public.board_cards;
CREATE POLICY "Cards insertable on open boards" ON public.board_cards
  FOR INSERT WITH CHECK (public.board_is_open(board_id));

-- The ownership hash is a delete credential: never expose it to clients.
REVOKE SELECT (author_token_hash) ON public.board_cards FROM anon, authenticated;

-- board_comments ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read comments" ON public.board_comments;
CREATE POLICY "Comments readable for existing cards" ON public.board_comments
  FOR SELECT USING (public.card_exists(card_id));

-- board_likes ---------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read likes" ON public.board_likes;
CREATE POLICY "Board owners read likes" ON public.board_likes
  FOR SELECT TO authenticated USING (public.card_board_owner(card_id) = auth.uid());

DROP POLICY IF EXISTS "Anyone can like" ON public.board_likes;
CREATE POLICY "Likes insertable on open boards" ON public.board_likes
  FOR INSERT WITH CHECK (public.card_board_is_open(card_id));

REVOKE SELECT (liker_token) ON public.board_likes FROM anon;

-- boards / polls ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can create boards" ON public.boards;
CREATE POLICY "Boards insertable by their own owner" ON public.boards
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can create polls" ON public.polls;
CREATE POLICY "Polls insertable by their own owner" ON public.polls
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- poll_votes ----------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can submit poll votes" ON public.poll_votes;
CREATE POLICY "Votes only on active polls" ON public.poll_votes
  FOR INSERT WITH CHECK (public.poll_is_active(poll_id));

-- barrage_messages ----------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read messages" ON public.barrage_messages;
CREATE POLICY "Messages readable for existing topics" ON public.barrage_messages
  FOR SELECT USING (public.topic_exists(topic_id));

DROP POLICY IF EXISTS "Anyone can send messages" ON public.barrage_messages;
CREATE POLICY "Messages insertable for existing topics" ON public.barrage_messages
  FOR INSERT WITH CHECK (public.topic_exists(topic_id));

-- storage -------------------------------------------------------------------
-- These two permissive policies have USING (false): they grant nothing and
-- only confuse policy review. Default-deny already applies.
DROP POLICY IF EXISTS "Deny DELETE on storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Deny UPDATE on storage objects" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can upload board media" ON storage.objects;
CREATE POLICY "Board media uploads bound to a board" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'board-media'
    AND (storage.foldername(name))[1] IN ('boards','collab')
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.board_exists(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "Anyone can read board media" ON storage.objects;
CREATE POLICY "Board media readable for existing boards" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'board-media'
    AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.board_exists(((storage.foldername(name))[2])::uuid)
  );

-- ppt-images is a per-user bucket: reads stay scoped to the owning folder,
-- while published pages keep serving files through their public URLs.
DROP POLICY IF EXISTS "Public read ppt-images" ON storage.objects;
CREATE POLICY "Owners read own ppt-images" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'ppt-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );