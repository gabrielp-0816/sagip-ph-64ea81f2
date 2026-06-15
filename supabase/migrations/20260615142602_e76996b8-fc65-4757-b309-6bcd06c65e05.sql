
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- (commit enum value before using it in policies)
COMMIT;

DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;
CREATE POLICY "Super admins view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));
