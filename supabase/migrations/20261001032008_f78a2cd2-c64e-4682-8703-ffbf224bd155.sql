CREATE OR REPLACE FUNCTION public.claim_guest_content(p_board_tokens text[], p_quiz_tokens text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_b int := 0; v_q int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_board_tokens IS NOT NULL AND array_length(p_board_tokens,1) > 0 THEN
    UPDATE boards SET user_id = v_uid
      WHERE user_id IS NULL AND creator_token <> '' AND length(creator_token) >= 16 AND creator_token = ANY(p_board_tokens);
    GET DIAGNOSTICS v_b = ROW_COUNT;
  END IF;
  IF p_quiz_tokens IS NOT NULL AND array_length(p_quiz_tokens,1) > 0 THEN
    UPDATE quiz_sessions SET user_id = v_uid
      WHERE user_id IS NULL AND creator_token <> '' AND length(creator_token) >= 16 AND creator_token = ANY(p_quiz_tokens);
    GET DIAGNOSTICS v_q = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('boards', v_b, 'quiz_sessions', v_q);
END $$;
REVOKE ALL ON FUNCTION public.claim_guest_content(text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_content(text[], text[]) TO authenticated;