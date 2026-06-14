
-- Donation proof storage policies
CREATE POLICY "Donors upload their proof"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'donation-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Donors view their proof"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'donation-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins view all donation proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'donation-proofs' AND public.has_role(auth.uid(), 'admin'));

-- Release-proof uploads reuse the existing request-documents bucket; allow admins to upload there
CREATE POLICY "Admins upload release proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'request-documents' AND public.has_role(auth.uid(), 'admin'));
