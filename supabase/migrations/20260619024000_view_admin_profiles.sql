DROP POLICY IF EXISTS "Anyone views admin profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone views campaign creators" ON public.profiles;

-- Allow authenticated users to view profiles of admins, super admins, or any citizen who created/requested a disaster campaign
CREATE POLICY "Anyone views campaign creators" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    public.has_role(id, 'admin') OR 
    public.has_role(id, 'super_admin') OR
    EXISTS (
      SELECT 1 FROM public.disasters
      WHERE disasters.created_by = profiles.id
    )
  );
