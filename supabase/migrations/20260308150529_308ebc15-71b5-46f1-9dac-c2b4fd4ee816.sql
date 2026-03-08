
-- Add category_id and is_starred to quiz_questions
ALTER TABLE public.quiz_questions 
  ADD COLUMN IF NOT EXISTS category_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

-- Create quiz_categories table
CREATE TABLE IF NOT EXISTS public.quiz_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  parent_id uuid DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_categories_parent_fkey FOREIGN KEY (parent_id) REFERENCES public.quiz_categories(id) ON DELETE SET NULL
);

ALTER TABLE public.quiz_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own categories" ON public.quiz_categories
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add FK from quiz_questions to quiz_categories
ALTER TABLE public.quiz_questions 
  ADD CONSTRAINT quiz_questions_category_fkey 
  FOREIGN KEY (category_id) REFERENCES public.quiz_categories(id) ON DELETE SET NULL;

-- Create quiz_papers table
CREATE TABLE IF NOT EXISTS public.quiz_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  template jsonb DEFAULT NULL,
  total_score integer NOT NULL DEFAULT 100,
  is_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own papers" ON public.quiz_papers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
