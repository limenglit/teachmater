
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nickname text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nickname', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Colleges table
CREATE TABLE public.colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own colleges" ON public.colleges FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Classes table
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid REFERENCES public.colleges(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own classes" ON public.classes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Class students table
CREATE TABLE public.class_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  student_number text DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own students" ON public.class_students FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fix: Re-add UPDATE policy for checkin_sessions (needed for ending sessions)
CREATE POLICY "Anyone can update sessions" ON public.checkin_sessions FOR UPDATE USING (true) WITH CHECK (true);
