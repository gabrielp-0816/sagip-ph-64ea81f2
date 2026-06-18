-- Create the audit trigger function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  current_actor_id UUID;
  audit_action TEXT;
  entity_t TEXT;
  entity_i TEXT;
  meta JSONB;
BEGIN
  current_actor_id := auth.uid();
  entity_t := TG_TABLE_NAME;
  
  -- Determine action type and details based on the table name and operation
  IF TG_TABLE_NAME = 'profiles' THEN
    entity_i := NEW.id::text;
    IF TG_OP = 'UPDATE' THEN
      IF OLD.is_verified IS DISTINCT FROM NEW.is_verified THEN
        IF NEW.is_verified THEN
          audit_action := 'user.verify';
        ELSE
          audit_action := 'user.unverify';
        END IF;
        meta := jsonb_build_object('verified_by', current_actor_id);
      ELSIF OLD.is_suspended IS DISTINCT FROM NEW.is_suspended THEN
        IF NEW.is_suspended THEN
          audit_action := 'user.suspend';
        ELSE
          audit_action := 'user.unsuspend';
        END IF;
        meta := jsonb_build_object('suspended_by', current_actor_id);
      ELSE
        RETURN NEW; -- No admin actions on profiles table to log
      END IF;
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    IF TG_OP = 'INSERT' THEN
      entity_i := NEW.user_id::text;
      audit_action := 'user.roles_update';
      meta := jsonb_build_object('added_role', NEW.role);
    ELSIF TG_OP = 'DELETE' THEN
      entity_i := OLD.user_id::text;
      audit_action := 'user.roles_update';
      meta := jsonb_build_object('removed_role', OLD.role);
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'disasters' THEN
    IF TG_OP = 'INSERT' THEN
      entity_i := NEW.id::text;
      audit_action := 'disaster.create';
      meta := jsonb_build_object('name', NEW.name, 'city', NEW.city);
    ELSIF TG_OP = 'UPDATE' THEN
      entity_i := NEW.id::text;
      IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed' THEN
        audit_action := 'disaster.close';
        meta := jsonb_build_object('name', NEW.name);
      ELSE
        audit_action := 'disaster.update';
        meta := jsonb_build_object('name', NEW.name, 'status', NEW.status);
      END IF;
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'fund_requests' THEN
    entity_i := NEW.id::text;
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        audit_action := 'request.' || NEW.status; -- request.approved, request.rejected, request.under_review
        meta := jsonb_build_object('notes', NEW.reviewer_notes);
      ELSIF OLD.reviewer_notes IS DISTINCT FROM NEW.reviewer_notes THEN
        audit_action := 'request.verify';
        meta := jsonb_build_object('notes', NEW.reviewer_notes);
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'fund_releases' THEN
    IF TG_OP = 'INSERT' THEN
      entity_i := NEW.request_id::text;
      audit_action := 'request.release';
      meta := jsonb_build_object(
        'amount', NEW.amount,
        'reference_number', NEW.reference_number,
        'notes', NEW.notes
      );
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'fund_allocations' THEN
    IF TG_OP = 'INSERT' THEN
      entity_i := NEW.id::text;
      audit_action := 'allocation.create';
      meta := jsonb_build_object('label', NEW.label, 'amount', NEW.allocated_amount);
    ELSIF TG_OP = 'DELETE' THEN
      entity_i := OLD.id::text;
      audit_action := 'allocation.delete';
      meta := jsonb_build_object('label', OLD.label, 'amount', OLD.allocated_amount);
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'admin_invite_codes' THEN
    IF TG_OP = 'INSERT' THEN
      entity_i := NEW.id::text;
      audit_action := 'admin.invite_code_created';
      meta := jsonb_build_object('code', NEW.code, 'note', NEW.note);
    ELSE
      RETURN NEW;
    END IF;
  
  ELSE
    RETURN NEW;
  END IF;

  -- Insert the audit log entry
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (current_actor_id, audit_action, entity_t, entity_i, meta);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach triggers to administrative tables
DROP TRIGGER IF EXISTS audit_profiles_trg ON public.profiles;
CREATE TRIGGER audit_profiles_trg
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_user_roles_trg ON public.user_roles;
CREATE TRIGGER audit_user_roles_trg
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_disasters_trg ON public.disasters;
CREATE TRIGGER audit_disasters_trg
AFTER INSERT OR UPDATE ON public.disasters
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_fund_requests_trg ON public.fund_requests;
CREATE TRIGGER audit_fund_requests_trg
AFTER UPDATE ON public.fund_requests
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_fund_releases_trg ON public.fund_releases;
CREATE TRIGGER audit_fund_releases_trg
AFTER INSERT ON public.fund_releases
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_fund_allocations_trg ON public.fund_allocations;
CREATE TRIGGER audit_fund_allocations_trg
AFTER INSERT OR DELETE ON public.fund_allocations
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_admin_invite_codes_trg ON public.admin_invite_codes;
CREATE TRIGGER audit_admin_invite_codes_trg
AFTER INSERT ON public.admin_invite_codes
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Backfill historical actions into audit_logs
-- 1. Backfill disasters
INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT 
  created_by as actor_id,
  'disaster.create' as action,
  'disasters' as entity_type,
  id::text as entity_id,
  jsonb_build_object('name', name, 'city', city) as metadata,
  created_at
FROM public.disasters
ON CONFLICT DO NOTHING;

INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT 
  created_by as actor_id,
  'disaster.close' as action,
  'disasters' as entity_type,
  id::text as entity_id,
  jsonb_build_object('name', name) as metadata,
  COALESCE(closed_at, updated_at) as created_at
FROM public.disasters
WHERE status = 'closed'
ON CONFLICT DO NOTHING;

-- 2. Backfill allocations
INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT 
  created_by as actor_id,
  'allocation.create' as action,
  'fund_allocations' as entity_type,
  id::text as entity_id,
  jsonb_build_object('label', label, 'amount', allocated_amount) as metadata,
  created_at
FROM public.fund_allocations
ON CONFLICT DO NOTHING;

-- 3. Backfill releases
INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT 
  released_by as actor_id,
  'request.release' as action,
  'fund_requests' as entity_type,
  request_id::text as entity_id,
  jsonb_build_object('amount', amount, 'reference_number', reference_number, 'notes', notes) as metadata,
  released_at as created_at
FROM public.fund_releases
ON CONFLICT DO NOTHING;

-- 4. Backfill user verification
INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT 
  NULL as actor_id,
  'user.verify' as action,
  'profiles' as entity_type,
  id::text as entity_id,
  jsonb_build_object('verified_by', NULL::text) as metadata,
  created_at
FROM public.profiles
WHERE is_verified = true
ON CONFLICT DO NOTHING;

-- 5. Backfill user suspension
INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT 
  NULL as actor_id,
  'user.suspend' as action,
  'profiles' as entity_type,
  id::text as entity_id,
  jsonb_build_object('suspended_by', NULL::text) as metadata,
  created_at
FROM public.profiles
WHERE is_suspended = true
ON CONFLICT DO NOTHING;

-- 6. Backfill user roles (for admins / super admins)
INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT 
  NULL as actor_id,
  'user.roles_update' as action,
  'user_roles' as entity_type,
  user_id::text as entity_id,
  jsonb_build_object('added_role', role) as metadata,
  created_at
FROM public.user_roles
WHERE role IN ('admin', 'super_admin')
ON CONFLICT DO NOTHING;

-- 7. Backfill invite codes
INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT 
  created_by as actor_id,
  'admin.invite_code_created' as action,
  'admin_invite_codes' as entity_type,
  id::text as entity_id,
  jsonb_build_object('code', code, 'note', note) as metadata,
  created_at
FROM public.admin_invite_codes
ON CONFLICT DO NOTHING;

-- 8. Backfill reviewed requests
INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
SELECT 
  reviewed_by as actor_id,
  'request.' || status as action,
  'fund_requests' as entity_type,
  id::text as entity_id,
  jsonb_build_object('notes', reviewer_notes) as metadata,
  COALESCE(reviewed_at, updated_at) as created_at
FROM public.fund_requests
WHERE status IN ('approved', 'rejected', 'under_review')
ON CONFLICT DO NOTHING;
