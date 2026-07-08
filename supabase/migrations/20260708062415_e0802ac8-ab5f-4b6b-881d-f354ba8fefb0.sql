
DROP POLICY IF EXISTS "user_pages_public_read" ON storage.objects;
CREATE POLICY "user_pages_public_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'user-pages'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_pages up
      WHERE up.storage_path = storage.objects.name AND up.is_public = true
    )
    OR (auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1])
  )
);

DROP POLICY IF EXISTS "Anyone can read community files" ON storage.objects;
CREATE POLICY "Community files readable when approved" ON storage.objects
FOR SELECT USING (
  bucket_id = 'community-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.community_posts cp
      WHERE cp.status = 'approved'
        AND cp.file_url LIKE '%/community-files/' || storage.objects.name
    )
    OR (auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1])
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
  )
);
