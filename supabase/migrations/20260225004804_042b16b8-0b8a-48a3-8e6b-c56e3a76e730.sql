
-- Add creator_token to track topic ownership
ALTER TABLE public.discussion_topics ADD COLUMN creator_token text;

-- Function to update topic (verifies token)
CREATE OR REPLACE FUNCTION public.update_topic(p_topic_id uuid, p_token text, p_title text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;
  UPDATE discussion_topics SET title = p_title WHERE id = p_topic_id AND creator_token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized or topic not found';
  END IF;
END;
$$;

-- Function to delete topic and its messages (verifies token)
CREATE OR REPLACE FUNCTION public.delete_topic(p_topic_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;
  -- Verify ownership first
  IF NOT EXISTS (SELECT 1 FROM discussion_topics WHERE id = p_topic_id AND creator_token = p_token) THEN
    RAISE EXCEPTION 'Unauthorized or topic not found';
  END IF;
  -- Delete messages first, then topic
  DELETE FROM barrage_messages WHERE topic_id = p_topic_id;
  DELETE FROM discussion_topics WHERE id = p_topic_id AND creator_token = p_token;
END;
$$;
