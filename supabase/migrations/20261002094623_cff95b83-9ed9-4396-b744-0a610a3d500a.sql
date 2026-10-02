DROP POLICY IF EXISTS "Seat chart uploads allowed" ON storage.objects;
DROP POLICY IF EXISTS "Seat charts publicly readable" ON storage.objects;

CREATE POLICY "Seat chart uploads owner-bound" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'board-media'
  AND (storage.foldername(name))[1] = 'seat-charts'
  AND (storage.foldername(name))[2] = (select auth.uid()::text)
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
);

CREATE POLICY "Seat chart guest uploads" ON storage.objects
FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'board-media'
  AND (storage.foldername(name))[1] = 'seat-charts'
  AND (storage.foldername(name))[2] = 'guest'
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
);