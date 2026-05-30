-- 让 user_pages 默认公开，并把已有记录改为公开
ALTER TABLE public.user_pages ALTER COLUMN is_public SET DEFAULT true;
UPDATE public.user_pages SET is_public = true WHERE is_public = false;