-- Drop the audit triggers
DROP TRIGGER IF EXISTS audit_profiles_trg ON public.profiles;
DROP TRIGGER IF EXISTS audit_user_roles_trg ON public.user_roles;
DROP TRIGGER IF EXISTS audit_disasters_trg ON public.disasters;
DROP TRIGGER IF EXISTS audit_fund_requests_trg ON public.fund_requests;
DROP TRIGGER IF EXISTS audit_fund_releases_trg ON public.fund_releases;
DROP TRIGGER IF EXISTS audit_fund_allocations_trg ON public.fund_allocations;
DROP TRIGGER IF EXISTS audit_admin_invite_codes_trg ON public.admin_invite_codes;

-- Drop the trigger function
DROP FUNCTION IF EXISTS public.process_audit_log();

-- Drop the audit_logs table (this automatically drops associated policies and grants)
DROP TABLE IF EXISTS public.audit_logs;
