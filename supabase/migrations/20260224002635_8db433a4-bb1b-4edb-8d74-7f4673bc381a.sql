
-- Discussion topics table
CREATE TABLE public.discussion_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.discussion_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read topics" ON public.discussion_topics FOR SELECT USING (true);
CREATE POLICY "Anyone can create topics" ON public.discussion_topics FOR INSERT WITH CHECK (true);

-- Barrage messages table
CREATE TABLE public.barrage_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.discussion_topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.barrage_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read messages" ON public.barrage_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can send messages" ON public.barrage_messages FOR INSERT WITH CHECK (true);

-- Enable realtime for barrage messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.barrage_messages;
