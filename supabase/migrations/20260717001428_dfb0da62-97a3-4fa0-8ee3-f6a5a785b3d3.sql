CREATE OR REPLACE FUNCTION public.admin_update_ai_credit_order_screenshot(
  p_order_id uuid,
  p_screenshot_url text,
  p_payer_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.ai_credit_orders
  SET screenshot_url = COALESCE(p_screenshot_url, screenshot_url),
      payer_note = COALESCE(p_payer_note, payer_note)
  WHERE id = p_order_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found or not pending';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_ai_credit_order_screenshot(uuid, text, text) TO authenticated;