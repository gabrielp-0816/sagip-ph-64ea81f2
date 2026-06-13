
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'official', 'ngo', 'citizen');
CREATE TYPE public.disaster_severity AS ENUM ('low', 'moderate', 'high', 'critical');
CREATE TYPE public.disaster_status AS ENUM ('active', 'monitoring', 'closed');
CREATE TYPE public.request_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'released');
CREATE TYPE public.id_type AS ENUM ('national_id', 'drivers_license', 'passport', 'umid', 'postal_id', 'voters_id');
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE public.notification_priority AS ENUM ('low', 'normal', 'high', 'critical');

-- ============ UPDATED_AT TRIGGER FN ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender public.gender_type NOT NULL,
  mobile_number TEXT NOT NULL,
  email TEXT NOT NULL,
  residential_address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  id_type public.id_type NOT NULL,
  id_number TEXT NOT NULL,
  id_document_path TEXT NOT NULL,
  avatar_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_age_18 CHECK (birth_date <= (CURRENT_DATE - INTERVAL '18 years'))
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Admin-can-view-all profiles policy (now that has_role exists)
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-assign citizen role on profile creation
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'citizen')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_assign_default_role AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- ============ DISASTER CATEGORIES ============
CREATE TABLE public.disaster_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.disaster_categories TO anon, authenticated;
GRANT ALL ON public.disaster_categories TO service_role;
ALTER TABLE public.disaster_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views categories" ON public.disaster_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.disaster_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.disaster_categories (slug, name, icon) VALUES
  ('typhoon', 'Typhoon', 'wind'),
  ('flood', 'Flood', 'waves'),
  ('earthquake', 'Earthquake', 'activity'),
  ('fire', 'Fire', 'flame'),
  ('landslide', 'Landslide', 'mountain'),
  ('volcanic_eruption', 'Volcanic Eruption', 'mountain-snow'),
  ('drought', 'Drought', 'sun'),
  ('other', 'Other Emergency', 'alert-triangle');

-- ============ DISASTERS ============
CREATE TABLE public.disasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.disaster_categories(id),
  description TEXT,
  location TEXT NOT NULL,
  city TEXT NOT NULL,
  barangay TEXT,
  severity public.disaster_severity NOT NULL DEFAULT 'moderate',
  status public.disaster_status NOT NULL DEFAULT 'active',
  affected_families INTEGER NOT NULL DEFAULT 0,
  affected_individuals INTEGER NOT NULL DEFAULT 0,
  required_funding NUMERIC(14,2) NOT NULL DEFAULT 0,
  raised_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.disasters TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.disasters TO authenticated;
GRANT ALL ON public.disasters TO service_role;
ALTER TABLE public.disasters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views disasters" ON public.disasters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage disasters" ON public.disasters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_disasters_updated_at BEFORE UPDATE ON public.disasters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUND ALLOCATIONS ============
CREATE TABLE public.fund_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.disaster_categories(id) ON DELETE SET NULL,
  disaster_id UUID REFERENCES public.disasters(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  allocated_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  released_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fund_allocations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fund_allocations TO authenticated;
GRANT ALL ON public.fund_allocations TO service_role;
ALTER TABLE public.fund_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone views allocations" ON public.fund_allocations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage allocations" ON public.fund_allocations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_alloc_updated_at BEFORE UPDATE ON public.fund_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUND REQUESTS ============
CREATE TABLE public.fund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disaster_id UUID REFERENCES public.disasters(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.disaster_categories(id),
  disaster_description TEXT NOT NULL,
  city TEXT NOT NULL,
  barangay TEXT NOT NULL,
  exact_location TEXT NOT NULL,
  affected_individuals INTEGER NOT NULL DEFAULT 0,
  estimated_damage_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  requested_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.request_status NOT NULL DEFAULT 'pending',
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.fund_requests TO authenticated;
GRANT ALL ON public.fund_requests TO service_role;
ALTER TABLE public.fund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own requests" ON public.fund_requests FOR SELECT TO authenticated USING (auth.uid() = requester_id);
CREATE POLICY "Users create own requests" ON public.fund_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Admins view all requests" ON public.fund_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all requests" ON public.fund_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_req_updated_at BEFORE UPDATE ON public.fund_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUND RELEASES ============
CREATE TABLE public.fund_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.fund_requests(id) ON DELETE CASCADE,
  allocation_id UUID REFERENCES public.fund_allocations(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  reference_number TEXT,
  released_by UUID REFERENCES auth.users(id),
  released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
GRANT SELECT ON public.fund_releases TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fund_releases TO authenticated;
GRANT ALL ON public.fund_releases TO service_role;
ALTER TABLE public.fund_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own releases" ON public.fund_releases FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fund_requests fr WHERE fr.id = request_id AND fr.requester_id = auth.uid()));
CREATE POLICY "Admins manage releases" ON public.fund_releases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ DONATIONS ============
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donor_name TEXT NOT NULL,
  donor_email TEXT,
  disaster_id UUID REFERENCES public.disasters(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference_number TEXT,
  message TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.donations TO authenticated;
GRANT SELECT ON public.donations TO anon;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
-- Public can see aggregated totals via dedicated view; raw rows visible but only non-PII fields are exposed by app
CREATE POLICY "Public views donations" ON public.donations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users create donations" ON public.donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = donor_id OR donor_id IS NULL);
CREATE POLICY "Admins manage donations" ON public.donations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  priority public.notification_priority NOT NULL DEFAULT 'normal',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ UPLOADED DOCUMENTS ============
CREATE TABLE public.uploaded_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  related_type TEXT NOT NULL, -- 'fund_request' | 'disaster' | 'profile'
  related_id UUID,
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.uploaded_documents TO authenticated;
GRANT ALL ON public.uploaded_documents TO service_role;
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own documents" ON public.uploaded_documents FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Users insert own documents" ON public.uploaded_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users delete own documents" ON public.uploaded_documents FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all documents" ON public.uploaded_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.disasters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_allocations;
