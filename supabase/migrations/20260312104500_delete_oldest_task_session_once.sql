DO $$
DECLARE
  v_oldest_id uuid;
BEGIN
  SELECT id
  INTO v_oldest_id
  FROM public.task_sessions
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  IF v_oldest_id IS NOT NULL THEN
    DELETE FROM public.task_sessions
    WHERE id = v_oldest_id;
  END IF;
END;
$$;
