
ALTER TABLE public.disasters
  ADD COLUMN IF NOT EXISTS closure_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closure_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_reason text;

CREATE OR REPLACE FUNCTION public.request_campaign_closure(_disaster_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator uuid;
BEGIN
  SELECT created_by INTO _creator FROM public.disasters WHERE id = _disaster_id;
  IF _creator IS NULL OR _creator <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to request closure for this campaign';
  END IF;
  UPDATE public.disasters
    SET closure_requested = true,
        closure_requested_at = now(),
        closure_reason = _reason
    WHERE id = _disaster_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_campaign_closure(uuid, text) TO authenticated;
