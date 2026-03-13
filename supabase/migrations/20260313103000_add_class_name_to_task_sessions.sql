-- Ensure class archive field exists for task checklist sessions.
ALTER TABLE public.task_sessions
ADD COLUMN IF NOT EXISTS class_name text;

-- Normalize data and constraints for compatibility with frontend/archive filters.
UPDATE public.task_sessions
SET class_name = ''
WHERE class_name IS NULL;

ALTER TABLE public.task_sessions
ALTER COLUMN class_name SET DEFAULT '';

ALTER TABLE public.task_sessions
ALTER COLUMN class_name SET NOT NULL;
