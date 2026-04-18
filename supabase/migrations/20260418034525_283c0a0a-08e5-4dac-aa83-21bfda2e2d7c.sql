-- Add sort_order to colleges and classes for user-defined ordering
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS sort_order numeric NOT NULL DEFAULT 0;
ALTER TABLE public.classes  ADD COLUMN IF NOT EXISTS sort_order numeric NOT NULL DEFAULT 0;

-- Backfill existing rows so each user's items get a sequential order based on creation time
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM public.colleges
)
UPDATE public.colleges c SET sort_order = ranked.rn
FROM ranked WHERE ranked.id = c.id AND c.sort_order = 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY college_id ORDER BY created_at) AS rn
  FROM public.classes
)
UPDATE public.classes c SET sort_order = ranked.rn
FROM ranked WHERE ranked.id = c.id AND c.sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_colleges_user_sort ON public.colleges(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_classes_college_sort ON public.classes(college_id, sort_order);