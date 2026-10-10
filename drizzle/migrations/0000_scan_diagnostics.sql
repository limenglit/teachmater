CREATE TABLE public.scan_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  page text NOT NULL DEFAULT '',
  ok boolean NOT NULL DEFAULT false,
  stage text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  elapsed_ms integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  ua text NOT NULL DEFAULT '',
  ios_version text NOT NULL DEFAULT '',
  wechat_version text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scan_diagnostics_created_idx ON public.scan_diagnostics (created_at DESC);

GRANT SELECT ON public.scan_diagnostics TO authenticated;
GRANT ALL ON public.scan_diagnostics TO service_role;

ALTER TABLE public.scan_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read scan diagnostics" ON public.scan_diagnostics
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_scan_diagnostic(
  p_session_id uuid, p_page text, p_ok boolean, p_stage text, p_error text,
  p_elapsed_ms integer, p_attempts integer, p_ua text, p_ios_version text, p_wechat_version text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.scan_diagnostics(session_id, page, ok, stage, error, elapsed_ms, attempts, ua, ios_version, wechat_version)
  VALUES (p_session_id, left(coalesce(p_page,''),40), coalesce(p_ok,false), left(coalesce(p_stage,''),40),
          left(coalesce(p_error,''),500), greatest(0, least(coalesce(p_elapsed_ms,0), 600000)),
          greatest(0, least(coalesce(p_attempts,0), 50)), left(coalesce(p_ua,''),400),
          left(coalesce(p_ios_version,''),20), left(coalesce(p_wechat_version,''),20));
END $$;
REVOKE ALL ON FUNCTION public.log_scan_diagnostic(uuid,text,boolean,text,text,integer,integer,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_scan_diagnostic(uuid,text,boolean,text,text,integer,integer,text,text,text) TO anon, authenticated;