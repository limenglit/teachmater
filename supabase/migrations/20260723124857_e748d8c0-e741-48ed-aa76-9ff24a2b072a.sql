-- discussion_topics: require creator_token format
DROP POLICY IF EXISTS "Anyone can create topics" ON public.discussion_topics;
CREATE POLICY "Anyone can create topics with token"
  ON public.discussion_topics FOR INSERT
  WITH CHECK (creator_token IS NOT NULL AND length(creator_token) >= 16);

-- board_comments: require card exists and its board is not locked
DROP POLICY IF EXISTS "Anyone can create comments" ON public.board_comments;
CREATE POLICY "Anyone can create comments on active boards"
  ON public.board_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.board_cards c
      JOIN public.boards b ON b.id = c.board_id
      WHERE c.id = board_comments.card_id
        AND COALESCE(b.is_locked, false) = false
    )
  );

-- board_strokes: image-tool updates only when board is not locked
DROP POLICY IF EXISTS "Anyone can update collaborative image strokes" ON public.board_strokes;
CREATE POLICY "Anyone can update collaborative image strokes"
  ON public.board_strokes FOR UPDATE
  USING (
    tool = 'image' AND EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_strokes.board_id
        AND b.is_collaborative = true
        AND COALESCE(b.is_locked, false) = false
    )
  )
  WITH CHECK (
    tool = 'image' AND EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_strokes.board_id
        AND b.is_collaborative = true
        AND COALESCE(b.is_locked, false) = false
    )
  );