
-- Tighten SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.assign_default_role() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

-- ============ STORAGE POLICIES ============

-- verification-ids: private; user can manage own folder (user_id is first path segment)
CREATE POLICY "verification_ids_own_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-ids' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "verification_ids_own_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-ids' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "verification_ids_admin_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-ids' AND public.has_role(auth.uid(), 'admin'));

-- request-documents
CREATE POLICY "req_docs_own_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'request-documents' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'request-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "req_docs_admin_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'request-documents' AND public.has_role(auth.uid(), 'admin'));

-- avatars
CREATE POLICY "avatars_own_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_admin_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'));

-- disaster-photos
CREATE POLICY "disaster_photos_auth_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'disaster-photos');
CREATE POLICY "disaster_photos_admin_write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'disaster-photos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'disaster-photos' AND public.has_role(auth.uid(), 'admin'));
