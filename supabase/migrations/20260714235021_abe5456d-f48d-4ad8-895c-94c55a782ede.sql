-- ============================================================
-- AI 算力充值套餐：订单表、用户余额表、RPC
-- ============================================================

-- 1. 用户已购算力余额
CREATE TABLE public.user_ai_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_balance int NOT NULL DEFAULT 0 CHECK (credits_balance >= 0),
  expires_at date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_ai_credits TO authenticated;
GRANT ALL ON public.user_ai_credits TO service_role;
ALTER TABLE public.user_ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credits" ON public.user_ai_credits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. 订单表
CREATE TABLE public.ai_credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_key text NOT NULL CHECK (package_key IN ('p10_100','p20_300')),
  amount_cny numeric(10,2) NOT NULL,
  credits int NOT NULL,
  pay_method text NOT NULL CHECK (pay_method IN ('wechat','alipay')),
  screenshot_url text,
  payer_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_credit_orders_user_idx ON public.ai_credit_orders(user_id, created_at DESC);
CREATE INDEX ai_credit_orders_status_idx ON public.ai_credit_orders(status, created_at DESC);
GRANT SELECT, INSERT ON public.ai_credit_orders TO authenticated;
GRANT ALL ON public.ai_credit_orders TO service_role;
ALTER TABLE public.ai_credit_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own orders" ON public.ai_credit_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own orders" ON public.ai_credit_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 3. 用户下单
CREATE OR REPLACE FUNCTION public.create_ai_credit_order(
  p_package_key text,
  p_pay_method text,
  p_screenshot_url text,
  p_payer_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_amount numeric(10,2);
  v_credits int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_package_key = 'p10_100' THEN v_amount := 10.00; v_credits := 100;
  ELSIF p_package_key = 'p20_300' THEN v_amount := 20.00; v_credits := 300;
  ELSE RAISE EXCEPTION 'Invalid package';
  END IF;
  IF p_pay_method NOT IN ('wechat','alipay') THEN RAISE EXCEPTION 'Invalid pay method'; END IF;

  INSERT INTO public.ai_credit_orders(user_id, package_key, amount_cny, credits, pay_method, screenshot_url, payer_note)
  VALUES (v_uid, p_package_key, v_amount, v_credits, p_pay_method, p_screenshot_url, p_payer_note)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 4. 管理员列表
CREATE OR REPLACE FUNCTION public.admin_list_ai_credit_orders(p_status text DEFAULT NULL)
RETURNS TABLE(
  id uuid, user_id uuid, email text, nickname text,
  package_key text, amount_cny numeric, credits int, pay_method text,
  screenshot_url text, payer_note text, status text, reject_reason text,
  created_at timestamptz, reviewed_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  RETURN QUERY
    SELECT o.id, o.user_id, u.email::text, p.nickname,
           o.package_key, o.amount_cny, o.credits, o.pay_method,
           o.screenshot_url, o.payer_note, o.status, o.reject_reason,
           o.created_at, o.reviewed_at
    FROM public.ai_credit_orders o
    JOIN auth.users u ON u.id = o.user_id
    LEFT JOIN public.profiles p ON p.user_id = o.user_id
    WHERE p_status IS NULL OR o.status = p_status
    ORDER BY o.created_at DESC;
END;
$$;

-- 5. 管理员通过订单
CREATE OR REPLACE FUNCTION public.admin_approve_ai_credit_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_today date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
  v_month_end date;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  SELECT * INTO v_order FROM public.ai_credit_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status <> 'pending' THEN RAISE EXCEPTION 'Order already reviewed'; END IF;

  v_month_end := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;

  INSERT INTO public.user_ai_credits(user_id, credits_balance, expires_at, updated_at)
  VALUES (v_order.user_id, v_order.credits, v_month_end, now())
  ON CONFLICT (user_id) DO UPDATE SET
    credits_balance = CASE
      WHEN public.user_ai_credits.expires_at IS NULL OR public.user_ai_credits.expires_at < v_today
        THEN EXCLUDED.credits_balance
      ELSE public.user_ai_credits.credits_balance + EXCLUDED.credits_balance
    END,
    expires_at = v_month_end,
    updated_at = now();

  UPDATE public.ai_credit_orders
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_order_id;
END;
$$;

-- 6. 管理员拒绝
CREATE OR REPLACE FUNCTION public.admin_reject_ai_credit_order(p_order_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  UPDATE public.ai_credit_orders
    SET status = 'rejected', reject_reason = COALESCE(p_reason,''),
        reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = p_order_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not pending'; END IF;
END;
$$;

-- 7. 查询我的可用余额（含过期判断）
CREATE OR REPLACE FUNCTION public.get_my_ai_credits()
RETURNS TABLE(balance int, expires_at date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
BEGIN
  RETURN QUERY
    SELECT
      CASE WHEN c.expires_at IS NULL OR c.expires_at < v_today THEN 0
           ELSE c.credits_balance END AS balance,
      c.expires_at
    FROM public.user_ai_credits c
    WHERE c.user_id = auth.uid();
END;
$$;

-- 8. 消费一次已购算力
CREATE OR REPLACE FUNCTION public.consume_purchased_ai_credit()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
  v_row RECORD;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_row FROM public.user_ai_credits WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_row.expires_at IS NULL OR v_row.expires_at < v_today THEN RETURN false; END IF;
  IF v_row.credits_balance <= 0 THEN RETURN false; END IF;
  UPDATE public.user_ai_credits
    SET credits_balance = credits_balance - 1, updated_at = now()
    WHERE user_id = v_uid;
  RETURN true;
END;
$$;

-- 9. 我的订单
CREATE OR REPLACE FUNCTION public.get_my_ai_credit_orders()
RETURNS SETOF public.ai_credit_orders
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.ai_credit_orders
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 50;
$$;