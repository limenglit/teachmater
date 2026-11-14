CREATE TABLE public.phone_cast_rooms (
 id uuid PRIMARY KEY,
 host_key uuid NOT NULL,
 phone_key uuid NOT NULL,
 phone_id uuid,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '4 hours',
 closed boolean NOT NULL DEFAULT false,
 seq bigint NOT NULL DEFAULT 0,
 events jsonb NOT NULL DEFAULT '[]'::jsonb,
 picture jsonb,
 picture_seq bigint NOT NULL DEFAULT 0
);
GRANT ALL ON public.phone_cast_rooms TO service_role;
ALTER TABLE public.phone_cast_rooms ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.phone_cast_exchange(p_room uuid, p_key uuid, p_role text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.phone_cast_rooms; ev jsonb; n bigint; peer uuid;
BEGIN
 IF p_role NOT IN ('host','phone') OR p_action NOT IN ('create','join','read','send','close') OR octet_length(p_payload::text) > 900000 THEN RAISE EXCEPTION 'Invalid request'; END IF;
 IF p_action = 'create' THEN
  IF p_role <> 'host' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM public.phone_cast_rooms WHERE expires_at < now();
  INSERT INTO public.phone_cast_rooms(id,host_key,phone_key) VALUES(p_room,p_key,(p_payload->>'phoneKey')::uuid);
 END IF;
 SELECT * INTO r FROM public.phone_cast_rooms WHERE id=p_room FOR UPDATE;
 IF NOT FOUND OR r.closed OR r.expires_at < now() THEN RAISE EXCEPTION 'Room expired'; END IF;
 IF (p_role='host' AND r.host_key<>p_key) OR (p_role='phone' AND r.phone_key<>p_key) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_action='join' THEN
  IF p_role<>'phone' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  peer := (p_payload->>'phoneId')::uuid;
  IF peer IS NULL OR (r.phone_id IS NOT NULL AND r.phone_id<>peer) THEN RAISE EXCEPTION 'Room busy'; END IF;
  UPDATE public.phone_cast_rooms SET phone_id=peer WHERE id=p_room;
  r.phone_id:=peer;
 END IF;
 IF p_role='phone' AND p_action IN ('read','send') AND (r.phone_id IS NULL OR r.phone_id IS DISTINCT FROM (p_payload->>'phoneId')::uuid) THEN RAISE EXCEPTION 'Room busy'; END IF;
 IF p_action='close' THEN
  IF p_role<>'host' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.phone_cast_rooms SET closed=true,events='[]'::jsonb,picture=NULL WHERE id=p_room;
  RETURN '{"closed":true}'::jsonb;
 END IF;
 IF p_action='send' THEN
  ev:=p_payload->'event';
  IF ev->>'type' NOT IN ('offer','answer','ice','stop','photo','frame') OR ev IS NULL THEN RAISE EXCEPTION 'Invalid event'; END IF;
  IF (ev->>'type' IN ('offer','photo','frame','stop') AND p_role<>'phone') OR (ev->>'type'='answer' AND p_role<>'host') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  n:=r.seq+1;
  IF ev->>'type' IN ('photo','frame') THEN
   IF ev->>'data' IS NULL OR ev->>'data' !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' THEN RAISE EXCEPTION 'Invalid image'; END IF;
   UPDATE public.phone_cast_rooms SET seq=n,picture=ev,picture_seq=n WHERE id=p_room;
  ELSE
   IF octet_length(ev::text)>32000 THEN RAISE EXCEPTION 'Event too large'; END IF;
   UPDATE public.phone_cast_rooms SET seq=n,events=(SELECT coalesce(jsonb_agg(value ORDER BY (value->>'seq')::bigint),'[]'::jsonb) FROM (SELECT value FROM jsonb_array_elements(r.events || jsonb_build_array(jsonb_build_object('seq',n,'role',p_role,'event',ev))) ORDER BY (value->>'seq')::bigint DESC LIMIT 100) q),picture=CASE WHEN ev->>'type' IN ('offer','stop') THEN NULL ELSE picture END WHERE id=p_room;
  END IF;
  RETURN jsonb_build_object('seq',n);
 END IF;
 RETURN jsonb_build_object('connected',r.phone_id IS NOT NULL,'events',(SELECT coalesce(jsonb_agg(value),'[]'::jsonb) FROM jsonb_array_elements(r.events) WHERE value->>'role'<>p_role AND (value->>'seq')::bigint>coalesce((p_payload->>'after')::bigint,0)), 'picture', CASE WHEN p_role='host' AND r.picture_seq>coalesce((p_payload->>'afterPicture')::bigint,0) THEN r.picture ELSE NULL END,'pictureSeq',r.picture_seq);
END; $$;
REVOKE ALL ON FUNCTION public.phone_cast_exchange(uuid,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phone_cast_exchange(uuid,uuid,text,text,jsonb) TO anon,authenticated,service_role;