
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Admins manage non-elevated roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND role NOT IN ('admin','super_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND role NOT IN ('admin','super_admin')
);

CREATE POLICY "Super admins manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
