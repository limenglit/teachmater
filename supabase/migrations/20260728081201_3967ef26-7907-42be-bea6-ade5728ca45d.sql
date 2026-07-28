CREATE POLICY "Users read own ai images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own ai images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own ai images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);