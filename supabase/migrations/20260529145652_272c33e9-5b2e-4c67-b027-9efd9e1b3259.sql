-- Page 发布功能：用户上传 HTML 文件，以 /用户名/页面名 形式公开访问

-- 1. profiles 表增加 username 字段
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL;

-- 2. user_pages 表：存储用户发布的 HTML 页面
CREATE TABLE IF NOT EXISTS public.user_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  html_content TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_pages_username_slug_key
  ON public.user_pages (LOWER(username), LOWER(slug));

CREATE INDEX IF NOT EXISTS user_pages_user_id_idx
  ON public.user_pages (user_id);

-- 3. GRANTs
GRANT SELECT ON public.user_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_pages TO authenticated;
GRANT ALL ON public.user_pages TO service_role;

-- 4. 启用 RLS
ALTER TABLE public.user_pages ENABLE ROW LEVEL SECURITY;

-- 5. 策略：公开页面任何人可读，所有者可全权管理
CREATE POLICY "Public pages viewable by everyone"
  ON public.user_pages FOR SELECT
  USING (is_public = true);

CREATE POLICY "Owners can view own pages"
  ON public.user_pages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert own pages"
  ON public.user_pages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own pages"
  ON public.user_pages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own pages"
  ON public.user_pages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. 时间戳触发器
CREATE OR REPLACE FUNCTION public.touch_user_pages_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_pages_set_updated_at ON public.user_pages;
CREATE TRIGGER user_pages_set_updated_at
  BEFORE UPDATE ON public.user_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_pages_updated_at();

-- 7. 设置 username 的安全函数（校验合法字符、保留字、唯一性）
CREATE OR REPLACE FUNCTION public.set_my_username(p_username TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_normalized TEXT;
  v_reserved TEXT[] := ARRAY[
    'auth','admin','discuss','checkin','go','seat-checkin','board','quiz','poll',
    'task','vocab','team-lookup','api-docs','seating-rule-check','reset-password',
    'pages','p','api','www','app','assets','static','public','help','about','login',
    'logout','signup','register','settings','user','users','profile','profiles',
    'storage','functions','docs','support','blog','home','index'
  ];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RAISE EXCEPTION 'Username required';
  END IF;
  v_normalized := lower(trim(p_username));
  IF length(v_normalized) < 3 OR length(v_normalized) > 32 THEN
    RAISE EXCEPTION 'Username must be 3-32 characters';
  END IF;
  IF v_normalized !~ '^[a-z0-9][a-z0-9_-]*[a-z0-9]$' THEN
    RAISE EXCEPTION 'Username may only contain letters, digits, hyphen and underscore';
  END IF;
  IF v_normalized = ANY(v_reserved) THEN
    RAISE EXCEPTION 'Username is reserved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(username) = v_normalized AND user_id <> v_uid) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;
  UPDATE public.profiles SET username = v_normalized WHERE user_id = v_uid;
  -- 同步已发布页面的 username 冗余字段
  UPDATE public.user_pages SET username = v_normalized WHERE user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_username(TEXT) TO authenticated;

-- 8. 获取 username 的便捷函数
CREATE OR REPLACE FUNCTION public.get_my_username()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT username FROM public.profiles WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_username() TO authenticated;

-- 9. 公开按 username + slug 查询页面（供匿名访问者使用）
CREATE OR REPLACE FUNCTION public.get_public_page(p_username TEXT, p_slug TEXT)
RETURNS TABLE(title TEXT, html_content TEXT, updated_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT title, html_content, updated_at
  FROM public.user_pages
  WHERE LOWER(username) = LOWER(p_username)
    AND LOWER(slug) = LOWER(p_slug)
    AND is_public = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_page(TEXT, TEXT) TO anon, authenticated;