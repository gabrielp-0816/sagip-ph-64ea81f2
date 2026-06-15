CREATE OR REPLACE FUNCTION public.recompute_disaster_raised(_disaster_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _disaster_id IS NULL THEN RETURN; END IF;
  UPDATE public.disasters
  SET raised_amount = COALESCE((SELECT SUM(amount) FROM public.donations WHERE disaster_id = _disaster_id), 0)
  WHERE id = _disaster_id;
END; $$;

CREATE OR REPLACE FUNCTION public.donations_sync_raised()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.recompute_disaster_raised(NEW.disaster_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.disaster_id IS DISTINCT FROM OLD.disaster_id THEN
      PERFORM public.recompute_disaster_raised(OLD.disaster_id);
      PERFORM public.recompute_disaster_raised(NEW.disaster_id);
    ELSIF NEW.amount IS DISTINCT FROM OLD.amount THEN
      PERFORM public.recompute_disaster_raised(NEW.disaster_id);
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.recompute_disaster_raised(OLD.disaster_id);
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_donations_sync_raised ON public.donations;
CREATE TRIGGER trg_donations_sync_raised
AFTER INSERT OR UPDATE OR DELETE ON public.donations
FOR EACH ROW EXECUTE FUNCTION public.donations_sync_raised();

UPDATE public.disasters d
SET raised_amount = COALESCE(s.total, 0)
FROM (SELECT disaster_id, SUM(amount) AS total FROM public.donations WHERE disaster_id IS NOT NULL GROUP BY disaster_id) s
WHERE d.id = s.disaster_id;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Donors read own donation proofs') THEN
    CREATE POLICY "Donors read own donation proofs"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'donation-proofs' AND (auth.uid()::text = (storage.foldername(name))[1]));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins read release proofs') THEN
    CREATE POLICY "Admins read release proofs"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'request-documents' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;