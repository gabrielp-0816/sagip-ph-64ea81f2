DROP TRIGGER IF EXISTS donations_sync_raised_trg ON public.donations;
CREATE TRIGGER donations_sync_raised_trg
AFTER INSERT OR UPDATE OR DELETE ON public.donations
FOR EACH ROW EXECUTE FUNCTION public.donations_sync_raised();

-- Backfill current raised_amount values
UPDATE public.disasters d
SET raised_amount = COALESCE(s.total, 0)
FROM (SELECT disaster_id, SUM(amount) AS total FROM public.donations GROUP BY disaster_id) s
WHERE s.disaster_id = d.id;

UPDATE public.disasters
SET raised_amount = 0
WHERE id NOT IN (SELECT DISTINCT disaster_id FROM public.donations WHERE disaster_id IS NOT NULL);