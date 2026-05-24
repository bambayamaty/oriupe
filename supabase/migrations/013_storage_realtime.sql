-- ═══════════════════════════════════════════════════════════════════
-- 013_storage_realtime.sql — Storage Buckets & Realtime
-- À exécuter via le Dashboard Supabase ou la CLI
-- ═══════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════
-- STORAGE BUCKETS
-- Note: créer via Dashboard ou supabase CLI
-- Ces INSERT sont pour la migration programmatique
-- ════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Avatars utilisateurs (public)
  ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg','image/png','image/webp']),

  -- Médias des services (public si service publié)
  ('service-media', 'service-media', FALSE, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']),

  -- Fichiers des projets clients
  ('project-files', 'project-files', FALSE, 20971520, NULL),

  -- Documents KYC (strictement privés)
  ('kyc-documents', 'kyc-documents', FALSE, 10485760,
   ARRAY['image/jpeg','image/png','application/pdf']),

  -- Pièces jointes messagerie
  ('message-attachments', 'message-attachments', FALSE, 20971520, NULL),

  -- Fichiers de livraison
  ('delivery-files', 'delivery-files', FALSE, 52428800, NULL),

  -- Médias posts/blog
  ('post-media', 'post-media', FALSE, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════
-- STORAGE POLICIES
-- ════════════════════════════════════════════

-- ── avatars ──────────────────────────────────────────────────────────
-- Lecture publique
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Upload: propriétaire uniquement (path: {user_id}/avatar.*)
CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- ── service-media ─────────────────────────────────────────────────────
-- Lecture publique si service publié (path: {service_id}/*)
CREATE POLICY "service_media_public_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'service-media'
    AND (
      -- Service publié: lecture publique
      EXISTS (
        SELECT 1 FROM services
        WHERE id::TEXT = (storage.foldername(name))[1]
          AND status = 'published'
      )
      -- Propriétaire du service
      OR EXISTS (
        SELECT 1 FROM services s
        JOIN freelance_profiles fp ON fp.id = s.freelance_id
        WHERE s.id::TEXT = (storage.foldername(name))[1]
          AND fp.profile_id = auth.uid()
      )
      -- Admin
      OR fn_is_admin()
    )
  );

CREATE POLICY "service_media_owner_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'service-media'
    AND EXISTS (
      SELECT 1 FROM services s
      JOIN freelance_profiles fp ON fp.id = s.freelance_id
      WHERE s.id::TEXT = (storage.foldername(name))[1]
        AND fp.profile_id = auth.uid()
    )
  );

-- ── project-files ─────────────────────────────────────────────────────
CREATE POLICY "project_files_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND (
      EXISTS (
        SELECT 1 FROM projects p
        LEFT JOIN orders o ON o.project_id = p.id
        LEFT JOIN freelance_profiles fp ON fp.id = o.freelance_id
        WHERE p.id::TEXT = (storage.foldername(name))[1]
          AND (p.client_id = auth.uid() OR fp.profile_id = auth.uid())
      )
      OR fn_is_admin()
    )
  );

CREATE POLICY "project_files_owner_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id::TEXT = (storage.foldername(name))[1]
        AND client_id = auth.uid()
    )
  );

-- ── kyc-documents ─────────────────────────────────────────────────────
CREATE POLICY "kyc_docs_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents'
    AND (
      auth.uid()::TEXT = (storage.foldername(name))[1]
      OR fn_has_admin_role('moderator')
      OR fn_has_admin_role('super_admin')
    )
  );

CREATE POLICY "kyc_docs_owner_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- ── message-attachments ───────────────────────────────────────────────
CREATE POLICY "msg_attach_participant_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'message-attachments'
    AND (
      fn_is_conversation_participant((storage.foldername(name))[1]::UUID)
      OR fn_is_admin()
    )
  );

CREATE POLICY "msg_attach_participant_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND fn_is_conversation_participant((storage.foldername(name))[1]::UUID)
  );

-- ── delivery-files ───────────────────────────────────────────────────
CREATE POLICY "delivery_files_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'delivery-files'
    AND (
      EXISTS (
        SELECT 1 FROM orders o
        LEFT JOIN freelance_profiles fp ON fp.id = o.freelance_id
        WHERE o.id::TEXT = (storage.foldername(name))[1]
          AND (o.client_id = auth.uid() OR fp.profile_id = auth.uid())
      )
      OR fn_is_admin()
    )
  );

CREATE POLICY "delivery_files_freelance_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'delivery-files'
    AND EXISTS (
      SELECT 1 FROM orders o
      JOIN freelance_profiles fp ON fp.id = o.freelance_id
      WHERE o.id::TEXT = (storage.foldername(name))[1]
        AND fp.profile_id = auth.uid()
    )
  );

-- ── post-media ───────────────────────────────────────────────────────
CREATE POLICY "post_media_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'post-media'
    AND (
      EXISTS (
        SELECT 1 FROM posts
        WHERE id::TEXT = (storage.foldername(name))[1]
          AND status = 'published'
      )
      OR fn_is_admin()
    )
  );

CREATE POLICY "post_media_admin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-media' AND fn_is_admin());

-- ════════════════════════════════════════════
-- REALTIME — Tables à activer
-- Commande CLI: supabase realtime enable --table <table>
-- Ou via Dashboard: Database → Replication
-- ════════════════════════════════════════════

/*
  Tables à activer pour Realtime (postgres_changes):

  1. messages
     - Events: INSERT, UPDATE
     - Filter par conversation_id (côté client)

  2. conversation_participants
     - Events: INSERT, UPDATE
     - Permet de détecter qu'on est ajouté à une conversation

  3. notifications
     - Events: INSERT
     - Filter: user_id = auth.uid()

  4. orders
     - Events: UPDATE
     - Filter: client_id ou freelance_id

  5. escrow_transactions
     - Events: UPDATE
     - Filter: order_id

  6. project_proposals
     - Events: INSERT, UPDATE
     - Filter: project_id ou freelance_id

  Configuration CLI:

  supabase db push

  Puis dans le Dashboard Supabase:
  Database → Replication → Cocher les tables ci-dessus

  Pour les abonnements côté client (supabase-js):

  // Exemple: messages en temps réel
  supabase
    .channel('conv:' + conversationId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, handleNewMessage)
    .subscribe()

  // Exemple: notifications
  supabase
    .channel('notif:' + userId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, handleNotification)
    .subscribe()
*/
