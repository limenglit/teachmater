
-- Polls table
CREATE TABLE public.polls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  poll_type text NOT NULL DEFAULT 'single',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  creator_token text NOT NULL DEFAULT (gen_random_uuid())::text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  user_id uuid
);

-- Poll votes table
CREATE TABLE public.poll_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  voter_token text NOT NULL DEFAULT '',
  voter_name text NOT NULL DEFAULT '匿名',
  selected_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls RLS: anyone can read and create, deny direct update/delete
CREATE POLICY "Anyone can read polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Anyone can create polls" ON public.polls FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny direct UPDATE polls" ON public.polls FOR UPDATE USING (false);
CREATE POLICY "Deny direct DELETE polls" ON public.polls FOR DELETE USING (false);

-- Poll votes RLS: anyone can read and create, deny update/delete
CREATE POLICY "Anyone can read poll votes" ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can submit poll votes" ON public.poll_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Deny UPDATE poll votes" ON public.poll_votes FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE poll votes" ON public.poll_votes FOR DELETE USING (false);

-- Enable realtime for poll_votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;

-- RPC to update poll (token-protected)
CREATE OR REPLACE FUNCTION public.update_poll(p_poll_id uuid, p_token text, p_status text DEFAULT NULL, p_title text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM polls WHERE id = p_poll_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE polls SET
    status = COALESCE(p_status, status),
    title = COALESCE(p_title, title),
    ended_at = CASE WHEN p_status = 'ended' THEN now() ELSE ended_at END
  WHERE id = p_poll_id AND creator_token = p_token;
END;
$$;

-- RPC to delete poll (token-protected)
CREATE OR REPLACE FUNCTION public.delete_poll(p_poll_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RAISE EXCEPTION 'Token required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM polls WHERE id = p_poll_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM polls WHERE id = p_poll_id AND creator_token = p_token;
END;
$$;
