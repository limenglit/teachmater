CREATE OR REPLACE FUNCTION public.get_seat_checkin_neighbor_status(p_session_id uuid, p_names text[])
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT r.student_name), ARRAY[]::text[])
  FROM public.seat_checkin_records r
  WHERE r.session_id = p_session_id
    AND array_length(p_names, 1) IS NOT NULL
    AND array_length(p_names, 1) <= 8
    AND btrim(regexp_replace(replace(r.student_name, '　', ' '), '\s+', ' ', 'g')) IN (
      SELECT btrim(regexp_replace(replace(n, '　', ' '), '\s+', ' ', 'g')) FROM unnest(p_names) AS n
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_seat_checkin_neighbor_status(uuid, text[]) TO anon, authenticated;