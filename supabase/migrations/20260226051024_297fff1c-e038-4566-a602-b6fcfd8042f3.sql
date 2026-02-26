
-- Add approval status to profiles
ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- Create user_roles table for admin management
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: only admins can read user_roles
CREATE POLICY "Admins can read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to approve a user (admin only)
CREATE OR REPLACE FUNCTION public.approve_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  UPDATE public.profiles SET status = 'approved' WHERE user_id = p_user_id;
END;
$$;

-- Function to reject a user (admin only)
CREATE OR REPLACE FUNCTION public.reject_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  UPDATE public.profiles SET status = 'rejected' WHERE user_id = p_user_id;
END;
$$;

-- Function to get pending users (admin only)
CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE(user_id uuid, email text, nickname text, status text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  RETURN QUERY
    SELECT p.user_id, u.email, p.nickname, p.status, p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    ORDER BY p.created_at DESC;
END;
$$;

-- Allow authenticated users to read their own profile status
-- (existing SELECT policy already covers this)

-- Function to get own profile status (for login check)
CREATE OR REPLACE FUNCTION public.get_my_status()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.profiles WHERE user_id = auth.uid()
$$;
