
DROP POLICY IF EXISTS "Anyone can read comments" ON public.community_comments;
CREATE POLICY "Read comments on approved posts" ON public.community_comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = community_comments.post_id
      AND (p.status = 'approved' OR p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

DROP POLICY IF EXISTS "Anyone can insert comments" ON public.community_comments;
CREATE POLICY "Insert comments on approved posts" ON public.community_comments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = community_comments.post_id AND p.status = 'approved'
  )
);

DROP POLICY IF EXISTS "Anyone can read likes" ON public.community_likes;
CREATE POLICY "Read likes on approved posts" ON public.community_likes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = community_likes.post_id
      AND (p.status = 'approved' OR p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

DROP POLICY IF EXISTS "Anyone can insert likes" ON public.community_likes;
CREATE POLICY "Insert likes on approved posts" ON public.community_likes
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = community_likes.post_id AND p.status = 'approved'
  )
);
