
-- Create storage bucket for board media uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('board-media', 'board-media', true);

-- Allow anyone to upload to board-media (students don't have auth)
CREATE POLICY "Anyone can upload board media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'board-media');
CREATE POLICY "Anyone can read board media" ON storage.objects FOR SELECT USING (bucket_id = 'board-media');
