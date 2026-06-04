-- 创建 user-pages 存储桶（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-pages', 'user-pages', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 公共读取策略
DROP POLICY IF EXISTS "user_pages_public_read" ON storage.objects;
CREATE POLICY "user_pages_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'user-pages');

-- 认证用户在自己目录下上传
DROP POLICY IF EXISTS "user_pages_auth_insert" ON storage.objects;
CREATE POLICY "user_pages_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-pages' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 认证用户更新自己目录下文件
DROP POLICY IF EXISTS "user_pages_auth_update" ON storage.objects;
CREATE POLICY "user_pages_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user-pages' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'user-pages' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 认证用户删除自己目录下文件
DROP POLICY IF EXISTS "user_pages_auth_delete" ON storage.objects;
CREATE POLICY "user_pages_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-pages' AND auth.uid()::text = (storage.foldername(name))[1]);