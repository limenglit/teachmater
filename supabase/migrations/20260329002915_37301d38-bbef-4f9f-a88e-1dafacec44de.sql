
-- Community posts table
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  course text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  knowledge_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  method text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  likes_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

-- Community comments table
CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '匿名',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Community likes table (prevent duplicate likes)
CREATE TABLE public.community_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  liker_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, liker_token)
);

-- Enable RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

-- Posts: anyone can read approved posts
CREATE POLICY "Anyone can read approved posts" ON public.community_posts
  FOR SELECT TO public USING (status = 'approved');

-- Posts: admins can read all posts (for review)
CREATE POLICY "Admins read all posts" ON public.community_posts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Posts: authenticated users can insert
CREATE POLICY "Auth users create posts" ON public.community_posts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Posts: owners can see own pending posts
CREATE POLICY "Owners read own posts" ON public.community_posts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Posts: admins can update (approve/reject)
CREATE POLICY "Admins update posts" ON public.community_posts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Posts: deny direct delete
CREATE POLICY "Deny delete posts" ON public.community_posts
  FOR DELETE TO public USING (false);

-- Comments: anyone can read
CREATE POLICY "Anyone can read comments" ON public.community_comments
  FOR SELECT TO public USING (true);

-- Comments: anyone can insert
CREATE POLICY "Anyone can insert comments" ON public.community_comments
  FOR INSERT TO public WITH CHECK (true);

-- Comments: deny update/delete
CREATE POLICY "Deny update comments" ON public.community_comments
  FOR UPDATE TO public USING (false);
CREATE POLICY "Deny delete comments" ON public.community_comments
  FOR DELETE TO public USING (false);

-- Likes: anyone can read
CREATE POLICY "Anyone can read likes" ON public.community_likes
  FOR SELECT TO public USING (true);

-- Likes: anyone can insert
CREATE POLICY "Anyone can insert likes" ON public.community_likes
  FOR INSERT TO public WITH CHECK (true);

-- Likes: deny update/delete
CREATE POLICY "Deny update likes" ON public.community_likes
  FOR UPDATE TO public USING (false);
CREATE POLICY "Deny delete likes" ON public.community_likes
  FOR DELETE TO public USING (false);

-- Trigger to auto-update likes_count
CREATE OR REPLACE FUNCTION public.update_community_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER community_likes_count_trigger
  AFTER INSERT ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_community_likes_count();

-- Enable realtime for community_posts and community_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;

-- Create storage bucket for community files
INSERT INTO storage.buckets (id, name, public) VALUES ('community-files', 'community-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for community-files bucket
CREATE POLICY "Anyone can read community files" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'community-files');

CREATE POLICY "Auth users upload community files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'community-files');
