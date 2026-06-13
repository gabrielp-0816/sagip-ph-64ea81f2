-- Relax profile fields so admin accounts (created via /admin-auth/signup) don't need citizen-only data.
ALTER TABLE public.profiles
  ALTER COLUMN birth_date DROP NOT NULL,
  ALTER COLUMN gender DROP NOT NULL,
  ALTER COLUMN mobile_number DROP NOT NULL,
  ALTER COLUMN residential_address DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN province DROP NOT NULL,
  ALTER COLUMN id_type DROP NOT NULL,
  ALTER COLUMN id_number DROP NOT NULL;

-- Single-use admin invite codes. Only admins (or service role) can manage; no one else can read.
CREATE TABLE public.admin_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invite_codes TO authenticated;
GRANT ALL ON public.admin_invite_codes TO service_role;

ALTER TABLE public.admin_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invite codes"
  ON public.admin_invite_codes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed a bootstrap code so the first administrator can register.
INSERT INTO public.admin_invite_codes (code, note)
VALUES ('SAGIP-ADMIN-BOOTSTRAP', 'Bootstrap code — rotate after first admin signs up')
ON CONFLICT (code) DO NOTHING;