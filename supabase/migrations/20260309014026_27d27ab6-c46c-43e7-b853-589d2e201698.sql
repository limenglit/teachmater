-- Create ppt-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('ppt-images', 'ppt-images', true);

-- Allow anyone to read from ppt-images
CREATE POLICY "Public read ppt-images" ON storage.objects FOR SELECT USING (bucket_id = 'ppt-images');

-- Allow anyone to upload to ppt-images
CREATE POLICY "Public upload ppt-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ppt-images');