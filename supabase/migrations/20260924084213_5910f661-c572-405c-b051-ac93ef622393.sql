CREATE POLICY "Seat chart uploads allowed" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'board-media'
    AND (storage.foldername(name))[1] = 'seat-charts'
  );

CREATE POLICY "Seat charts publicly readable" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'board-media'
    AND (storage.foldername(name))[1] = 'seat-charts'
  );