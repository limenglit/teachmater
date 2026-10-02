ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE public.quiz_sessions ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE public.checkin_sessions ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE public.seat_checkin_sessions ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_boards_user_class ON public.boards(user_id, class_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_class ON public.quiz_sessions(user_id, class_id);
CREATE INDEX IF NOT EXISTS idx_checkin_sessions_user_class ON public.checkin_sessions(user_id, class_id);
CREATE INDEX IF NOT EXISTS idx_seat_checkin_sessions_user_class ON public.seat_checkin_sessions(user_id, class_id);

-- Only allow assigning content to one of the caller's own classes
CREATE OR REPLACE FUNCTION public.enforce_owned_class_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.class_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = NEW.class_id AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Invalid class for this owner';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_boards_class BEFORE INSERT OR UPDATE OF class_id, user_id ON public.boards FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_class_id();
CREATE TRIGGER trg_quiz_sessions_class BEFORE INSERT OR UPDATE OF class_id, user_id ON public.quiz_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_class_id();
CREATE TRIGGER trg_checkin_sessions_class BEFORE INSERT OR UPDATE OF class_id, user_id ON public.checkin_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_class_id();
CREATE TRIGGER trg_seat_checkin_sessions_class BEFORE INSERT OR UPDATE OF class_id, user_id ON public.seat_checkin_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_class_id();

-- Owner moves an item into a class (or back to unassigned)
CREATE OR REPLACE FUNCTION public.set_content_class(p_kind text, p_id uuid, p_class_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); n int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_kind = 'board' THEN UPDATE boards SET class_id = p_class_id WHERE id = p_id AND user_id = v_uid;
  ELSIF p_kind = 'quiz' THEN UPDATE quiz_sessions SET class_id = p_class_id WHERE id = p_id AND user_id = v_uid;
  ELSIF p_kind = 'checkin' THEN UPDATE checkin_sessions SET class_id = p_class_id WHERE id = p_id AND user_id = v_uid;
  ELSIF p_kind = 'seat_checkin' THEN UPDATE seat_checkin_sessions SET class_id = p_class_id WHERE id = p_id AND user_id = v_uid;
  ELSE RAISE EXCEPTION 'Unknown kind'; END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'Not found'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.set_content_class(text, uuid, uuid) TO authenticated;