
-- Allow admins to send notifications to any user
CREATE POLICY "Admins insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all uploaded documents (verification, request docs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='uploaded_documents') THEN
    EXECUTE 'CREATE POLICY "Admins view all documents" ON public.uploaded_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
