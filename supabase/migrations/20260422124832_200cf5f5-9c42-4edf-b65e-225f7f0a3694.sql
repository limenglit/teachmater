-- ============== vocab_sets ==============
CREATE TABLE public.vocab_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT 'university', -- primary/junior/senior/university/vocational
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'private', -- private/pending/approved/rejected
  reject_reason text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  author_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

CREATE INDEX idx_vocab_sets_status ON public.vocab_sets(status);
CREATE INDEX idx_vocab_sets_user ON public.vocab_sets(user_id);

ALTER TABLE public.vocab_sets ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can read approved or system sets
CREATE POLICY "Public read approved vocab sets"
ON public.vocab_sets FOR SELECT
TO anon, authenticated
USING (status = 'approved' OR is_system = true);

-- Owners can read all their own sets
CREATE POLICY "Owners read own vocab sets"
ON public.vocab_sets FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins read everything
CREATE POLICY "Admins read all vocab sets"
ON public.vocab_sets FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Owners create
CREATE POLICY "Owners create vocab sets"
ON public.vocab_sets FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Owners update only their private/pending/rejected sets (cannot edit approved)
CREATE POLICY "Owners update editable vocab sets"
ON public.vocab_sets FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status IN ('private','pending','rejected'))
WITH CHECK (user_id = auth.uid() AND status IN ('private','pending','rejected'));

-- Admins update any
CREATE POLICY "Admins update vocab sets"
ON public.vocab_sets FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Owners delete own non-approved sets
CREATE POLICY "Owners delete own vocab sets"
ON public.vocab_sets FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND is_system = false);

-- Admins delete any non-system
CREATE POLICY "Admins delete vocab sets"
ON public.vocab_sets FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND is_system = false);


-- ============== vocab_cards ==============
CREATE TABLE public.vocab_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
  word text NOT NULL DEFAULT '',
  definition text NOT NULL DEFAULT '',
  example text NOT NULL DEFAULT '',
  word_image text NOT NULL DEFAULT '',
  definition_image text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vocab_cards_set ON public.vocab_cards(set_id, sort_order);

ALTER TABLE public.vocab_cards ENABLE ROW LEVEL SECURITY;

-- Read cards if set is readable
CREATE POLICY "Read cards of approved or system sets"
ON public.vocab_cards FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.vocab_sets s
  WHERE s.id = vocab_cards.set_id AND (s.status = 'approved' OR s.is_system = true)
));

CREATE POLICY "Owners read cards of own sets"
ON public.vocab_cards FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vocab_sets s
  WHERE s.id = vocab_cards.set_id AND s.user_id = auth.uid()
));

CREATE POLICY "Admins read all cards"
ON public.vocab_cards FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert/Update/Delete: only set owner of editable set
CREATE POLICY "Owners insert cards"
ON public.vocab_cards FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.vocab_sets s
  WHERE s.id = vocab_cards.set_id
    AND s.user_id = auth.uid()
    AND s.status IN ('private','pending','rejected')
));

CREATE POLICY "Owners update cards"
ON public.vocab_cards FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vocab_sets s
  WHERE s.id = vocab_cards.set_id
    AND s.user_id = auth.uid()
    AND s.status IN ('private','pending','rejected')
));

CREATE POLICY "Owners delete cards"
ON public.vocab_cards FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vocab_sets s
  WHERE s.id = vocab_cards.set_id
    AND s.user_id = auth.uid()
    AND s.status IN ('private','pending','rejected')
));

CREATE POLICY "Admins manage cards"
ON public.vocab_cards FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ============== Workflow functions ==============

-- Submit own private/rejected set for review
CREATE OR REPLACE FUNCTION public.submit_vocab_set(p_set_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vocab_sets WHERE id = p_set_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF (SELECT COUNT(*) FROM vocab_cards WHERE set_id = p_set_id) < 2 THEN
    RAISE EXCEPTION 'At least 2 cards required';
  END IF;
  UPDATE vocab_sets
    SET status = 'pending', reject_reason = '', updated_at = now()
    WHERE id = p_set_id AND user_id = auth.uid() AND status IN ('private','rejected');
END;
$$;

-- Withdraw a pending set (back to private)
CREATE OR REPLACE FUNCTION public.withdraw_vocab_set(p_set_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vocab_sets WHERE id = p_set_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE vocab_sets
    SET status = 'private', updated_at = now()
    WHERE id = p_set_id AND user_id = auth.uid() AND status = 'pending';
END;
$$;

-- Admin: approve
CREATE OR REPLACE FUNCTION public.approve_vocab_set(p_set_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  UPDATE vocab_sets
    SET status = 'approved', reject_reason = '', approved_at = now(), updated_at = now()
    WHERE id = p_set_id;
END;
$$;

-- Admin: reject with reason
CREATE OR REPLACE FUNCTION public.reject_vocab_set(p_set_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  UPDATE vocab_sets
    SET status = 'rejected', reject_reason = COALESCE(p_reason,''), updated_at = now()
    WHERE id = p_set_id;
END;
$$;

-- Admin: list pending sets with author email
CREATE OR REPLACE FUNCTION public.admin_list_pending_vocab_sets()
RETURNS TABLE (
  id uuid,
  title text,
  audience text,
  description text,
  author_name text,
  author_email text,
  card_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  RETURN QUERY
    SELECT s.id, s.title, s.audience, s.description, s.author_name,
           u.email::text,
           (SELECT COUNT(*) FROM vocab_cards c WHERE c.set_id = s.id),
           s.created_at
    FROM vocab_sets s
    LEFT JOIN auth.users u ON u.id = s.user_id
    WHERE s.status = 'pending'
    ORDER BY s.created_at ASC;
END;
$$;


-- ============== Seed: platform sets (system) ==============
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 元素周期表（前20号）
  INSERT INTO public.vocab_sets (title, audience, description, status, is_system, author_name)
  VALUES ('元素周期表（前20号）', 'senior', '化学基础：原子序数 1-20 的元素及其符号与中文名', 'approved', true, '平台')
  RETURNING id INTO v_id;
  INSERT INTO public.vocab_cards (set_id, word, definition, sort_order) VALUES
    (v_id, 'H 氢', '原子序数 1，最轻的元素', 1),
    (v_id, 'He 氦', '原子序数 2，惰性气体', 2),
    (v_id, 'Li 锂', '原子序数 3，最轻的金属', 3),
    (v_id, 'Be 铍', '原子序数 4', 4),
    (v_id, 'B 硼', '原子序数 5', 5),
    (v_id, 'C 碳', '原子序数 6，有机化学核心', 6),
    (v_id, 'N 氮', '原子序数 7，空气主要成分', 7),
    (v_id, 'O 氧', '原子序数 8，呼吸所需', 8),
    (v_id, 'F 氟', '原子序数 9，电负性最强', 9),
    (v_id, 'Ne 氖', '原子序数 10', 10),
    (v_id, 'Na 钠', '原子序数 11', 11),
    (v_id, 'Mg 镁', '原子序数 12', 12),
    (v_id, 'Al 铝', '原子序数 13', 13),
    (v_id, 'Si 硅', '原子序数 14，半导体核心', 14),
    (v_id, 'P 磷', '原子序数 15', 15),
    (v_id, 'S 硫', '原子序数 16', 16),
    (v_id, 'Cl 氯', '原子序数 17', 17),
    (v_id, 'Ar 氩', '原子序数 18', 18),
    (v_id, 'K 钾', '原子序数 19', 19),
    (v_id, 'Ca 钙', '原子序数 20', 20);

  -- 英语不规则动词
  INSERT INTO public.vocab_sets (title, audience, description, status, is_system, author_name)
  VALUES ('英语不规则动词', 'junior', '常见英语不规则动词的过去式与过去分词', 'approved', true, '平台')
  RETURNING id INTO v_id;
  INSERT INTO public.vocab_cards (set_id, word, definition, sort_order) VALUES
    (v_id, 'go', 'went / gone（去）', 1),
    (v_id, 'eat', 'ate / eaten（吃）', 2),
    (v_id, 'see', 'saw / seen（看见）', 3),
    (v_id, 'take', 'took / taken（拿、取）', 4),
    (v_id, 'give', 'gave / given（给）', 5),
    (v_id, 'come', 'came / come（来）', 6),
    (v_id, 'write', 'wrote / written（写）', 7),
    (v_id, 'read', 'read / read（读，发音变化）', 8),
    (v_id, 'speak', 'spoke / spoken（说）', 9),
    (v_id, 'break', 'broke / broken（打破）', 10),
    (v_id, 'choose', 'chose / chosen（选择）', 11),
    (v_id, 'drive', 'drove / driven（驾驶）', 12);

  -- 世界地理之最
  INSERT INTO public.vocab_sets (title, audience, description, status, is_system, author_name)
  VALUES ('世界地理之最', 'primary', '世界地理常识：最高山、最深海沟、最长河流等', 'approved', true, '平台')
  RETURNING id INTO v_id;
  INSERT INTO public.vocab_cards (set_id, word, definition, sort_order) VALUES
    (v_id, '最高的山', '珠穆朗玛峰（8848.86m）', 1),
    (v_id, '最深的海沟', '马里亚纳海沟（约 11,034m）', 2),
    (v_id, '最长的河流', '尼罗河（约 6,650km）', 3),
    (v_id, '流量最大的河', '亚马孙河', 4),
    (v_id, '最大的洋', '太平洋', 5),
    (v_id, '最大的沙漠', '撒哈拉沙漠', 6),
    (v_id, '最大的高原', '巴西高原（面积）/ 青藏高原（海拔）', 7),
    (v_id, '最大的盆地', '刚果盆地', 8),
    (v_id, '最大的半岛', '阿拉伯半岛', 9),
    (v_id, '最大的岛屿', '格陵兰岛', 10);

  -- 数学公式
  INSERT INTO public.vocab_sets (title, audience, description, status, is_system, author_name)
  VALUES ('常用数学公式', 'senior', '初高中常用代数与几何公式', 'approved', true, '平台')
  RETURNING id INTO v_id;
  INSERT INTO public.vocab_cards (set_id, word, definition, sort_order) VALUES
    (v_id, '完全平方公式', '(a±b)² = a² ± 2ab + b²', 1),
    (v_id, '平方差公式', 'a² − b² = (a+b)(a−b)', 2),
    (v_id, '一元二次求根公式', 'x = (−b ± √(b²−4ac)) / 2a', 3),
    (v_id, '勾股定理', '直角三角形中 a² + b² = c²', 4),
    (v_id, '圆面积', 'S = πr²', 5),
    (v_id, '圆周长', 'C = 2πr', 6),
    (v_id, '球体积', 'V = (4/3)πr³', 7),
    (v_id, '正弦定理', 'a/sinA = b/sinB = c/sinC = 2R', 8),
    (v_id, '余弦定理', 'c² = a² + b² − 2ab·cosC', 9),
    (v_id, '等差数列求和', 'Sn = n(a₁+aₙ)/2', 10);
END $$;
