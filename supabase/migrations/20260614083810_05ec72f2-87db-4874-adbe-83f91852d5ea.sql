
-- 1. Add proof_url to donations (nullable for back-compat; required in UI going forward)
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS proof_url text;

-- 2. Add proof_url to fund_releases (required in UI)
ALTER TABLE public.fund_releases ADD COLUMN IF NOT EXISTS proof_url text;

-- 3. Add verification fields to fund_requests for background verification step
ALTER TABLE public.fund_requests
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- 4. Drop the default-0 on numeric fields so they must be supplied (still NOT NULL, just no auto-zero)
ALTER TABLE public.fund_requests
  ALTER COLUMN affected_individuals DROP DEFAULT,
  ALTER COLUMN estimated_damage_cost DROP DEFAULT,
  ALTER COLUMN requested_amount DROP DEFAULT;

-- 5. Prevent duplicate active aid requests per (user, disaster). Allow re-applying after rejection.
CREATE UNIQUE INDEX IF NOT EXISTS fund_requests_unique_active_per_disaster
  ON public.fund_requests (requester_id, disaster_id)
  WHERE status IN ('pending', 'under_review', 'approved');

-- 6. Unified transactions view (read-only aggregate of donations + releases) for transaction history.
CREATE OR REPLACE VIEW public.transactions AS
  SELECT
    d.id,
    'donation'::text AS direction,
    d.created_at AS occurred_at,
    d.amount,
    COALESCE(c.name, 'General Fund') AS category,
    COALESCE(dis.name, 'General Fund') AS reference,
    CASE WHEN d.is_anonymous THEN 'Anonymous' ELSE d.donor_name END AS party,
    'received'::text AS status,
    d.reference_number,
    d.proof_url
  FROM public.donations d
  LEFT JOIN public.disasters dis ON dis.id = d.disaster_id
  LEFT JOIN public.disaster_categories c ON c.id = dis.category_id
  UNION ALL
  SELECT
    fr.id,
    'release'::text AS direction,
    fr.released_at AS occurred_at,
    fr.amount,
    COALESCE(c.name, 'Aid release') AS category,
    COALESCE(dis.name, req.disaster_description) AS reference,
    (p.first_name || ' ' || p.last_name) AS party,
    'released'::text AS status,
    fr.reference_number,
    fr.proof_url
  FROM public.fund_releases fr
  LEFT JOIN public.fund_requests req ON req.id = fr.request_id
  LEFT JOIN public.profiles p ON p.id = req.requester_id
  LEFT JOIN public.disasters dis ON dis.id = req.disaster_id
  LEFT JOIN public.disaster_categories c ON c.id = req.category_id;

GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.transactions TO service_role;
