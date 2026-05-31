-- ═══════════════════════════════════════════════════════════════════
-- 018_rls_missing_tables.sql — RLS sur 22 tables non protégées
-- Découvert lors de l'audit sécurité — toutes ces tables étaient
-- accessibles en lecture/écriture avec la clé anon publique.
-- ═══════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════
-- Helpers réutilisés
-- ════════════════════════════════════════════

-- Vérifie si l'utilisateur courant est une partie d'un order
-- (client direct OU freelance via freelance_profiles)
CREATE OR REPLACE FUNCTION fn_is_order_party(p_order_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id
    AND (
      o.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM freelance_profiles fp
        WHERE fp.id = o.freelance_id AND fp.profile_id = auth.uid()
      )
    )
  )
$$;

-- ════════════════════════════════════════════
-- 1. AUDIT LOGS
--    Utilisateurs voient leurs propres entrées.
--    Admins voient tout.
-- ════════════════════════════════════════════
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_own_select" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "audit_logs_admin" ON audit_logs USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 2. PAYMENT TRANSACTIONS
--    Parties de la commande uniquement.
-- ════════════════════════════════════════════
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_transactions_parties_select" ON payment_transactions
  FOR SELECT USING (fn_is_order_party(order_id));

CREATE POLICY "payment_transactions_admin" ON payment_transactions
  USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 3. ESCROW EVENTS
--    Parties via escrow_transactions → orders.
-- ════════════════════════════════════════════
ALTER TABLE escrow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escrow_events_parties_select" ON escrow_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM escrow_transactions et
      WHERE et.id = escrow_events.escrow_id
      AND fn_is_order_party(et.order_id)
    )
  );

CREATE POLICY "escrow_events_admin" ON escrow_events USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 4. ORDER DELIVERIES
-- ════════════════════════════════════════════
ALTER TABLE order_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_deliveries_parties_select" ON order_deliveries
  FOR SELECT USING (fn_is_order_party(order_id));

CREATE POLICY "order_deliveries_admin" ON order_deliveries USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 5. ORDER REVISIONS
-- ════════════════════════════════════════════
ALTER TABLE order_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_revisions_parties_select" ON order_revisions
  FOR SELECT USING (fn_is_order_party(order_id));

CREATE POLICY "order_revisions_admin" ON order_revisions USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 6. ADMIN PERMISSIONS
--    Lecture interne admin uniquement.
--    (matrice role/resource, pas de données utilisateur)
-- ════════════════════════════════════════════
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_permissions_admin_only" ON admin_permissions
  USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 7. ADMIN ROLES
--    Chaque utilisateur voit son propre rôle.
--    Admins voient tout et peuvent modifier.
-- ════════════════════════════════════════════
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_roles_select_own" ON admin_roles
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "admin_roles_admin" ON admin_roles USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 8. DISPUTE EVIDENCE
--    Parties voient + soumettent leurs preuves.
--    Admins voient tout.
-- ════════════════════════════════════════════
ALTER TABLE dispute_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispute_evidence_parties_select" ON dispute_evidence
  FOR SELECT USING (
    submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_evidence.dispute_id
      AND fn_is_order_party(d.order_id)
    )
  );

CREATE POLICY "dispute_evidence_parties_insert" ON dispute_evidence
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_evidence.dispute_id
      AND fn_is_order_party(d.order_id)
    )
  );

CREATE POLICY "dispute_evidence_admin" ON dispute_evidence USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 9. DISPUTE DECISIONS
--    Parties peuvent lire (pour connaître le verdict).
--    Seuls les admins peuvent insérer (append-only).
-- ════════════════════════════════════════════
ALTER TABLE dispute_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispute_decisions_parties_select" ON dispute_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_decisions.dispute_id
      AND fn_is_order_party(d.order_id)
    )
  );

CREATE POLICY "dispute_decisions_admin" ON dispute_decisions USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 10. MESSAGE ATTACHMENTS
--     Participants à la conversation uniquement.
-- ════════════════════════════════════════════
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_attachments_participants_select" ON message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_attachments.message_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "message_attachments_sender_insert" ON message_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_attachments.message_id
      AND m.sender_id = auth.uid()
    )
  );

CREATE POLICY "message_attachments_admin" ON message_attachments USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 11. MESSAGE READS
--     Chaque utilisateur gère ses propres accusés de lecture.
-- ════════════════════════════════════════════
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reads_own" ON message_reads
  USING (user_id = auth.uid());

CREATE POLICY "message_reads_admin" ON message_reads USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 12. PROJECT FILES
--     Client du projet, freelance assigné, ou uploader.
-- ════════════════════════════════════════════
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_files_parties_select" ON project_files
  FOR SELECT USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_files.project_id
      AND (
        p.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM freelance_profiles fp
          WHERE fp.id = p.assigned_freelance_id AND fp.profile_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "project_files_uploader_insert" ON project_files
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "project_files_admin" ON project_files USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 13. PROJECT INVITATIONS
--     Client qui invite OU freelance invité.
-- ════════════════════════════════════════════
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_invitations_parties_select" ON project_invitations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_invitations.project_id AND p.client_id = auth.uid())
    OR EXISTS (SELECT 1 FROM freelance_profiles fp WHERE fp.id = project_invitations.freelance_id AND fp.profile_id = auth.uid())
  );

CREATE POLICY "project_invitations_client_insert" ON project_invitations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_invitations.project_id AND p.client_id = auth.uid())
  );

CREATE POLICY "project_invitations_freelance_update" ON project_invitations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM freelance_profiles fp WHERE fp.id = project_invitations.freelance_id AND fp.profile_id = auth.uid())
  );

CREATE POLICY "project_invitations_admin" ON project_invitations USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 14. PROJECT SKILLS
--     Lecture publique (compétences demandées, non sensibles).
--     Écriture réservée au client du projet.
-- ════════════════════════════════════════════
ALTER TABLE project_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_skills_public_select" ON project_skills
  FOR SELECT USING (TRUE);

CREATE POLICY "project_skills_owner_write" ON project_skills
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_skills.project_id AND p.client_id = auth.uid())
  );

CREATE POLICY "project_skills_owner_delete" ON project_skills
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_skills.project_id AND p.client_id = auth.uid())
  );

-- ════════════════════════════════════════════
-- 15–18. PROFIL FREELANCE (certifications, expériences, langues, portfolio)
--     Lecture publique (vitrine du freelance).
--     Écriture réservée au freelance propriétaire.
-- ════════════════════════════════════════════

-- Helper : est-ce que auth.uid() possède ce freelance_profile ?
CREATE OR REPLACE FUNCTION fn_owns_freelance_profile(p_fp_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM freelance_profiles fp
    WHERE fp.id = p_fp_id AND fp.profile_id = auth.uid()
  )
$$;

ALTER TABLE freelance_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certifications_public_select"  ON freelance_certifications FOR SELECT USING (TRUE);
CREATE POLICY "certifications_owner_write"    ON freelance_certifications
  FOR ALL USING (fn_owns_freelance_profile(profile_id));

ALTER TABLE freelance_experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "experiences_public_select"     ON freelance_experiences FOR SELECT USING (TRUE);
CREATE POLICY "experiences_owner_write"       ON freelance_experiences
  FOR ALL USING (fn_owns_freelance_profile(profile_id));

ALTER TABLE freelance_languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "languages_public_select"       ON freelance_languages FOR SELECT USING (TRUE);
CREATE POLICY "languages_owner_write"         ON freelance_languages
  FOR ALL USING (fn_owns_freelance_profile(profile_id));

ALTER TABLE freelance_portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portfolio_public_select"       ON freelance_portfolio_items FOR SELECT USING (TRUE);
CREATE POLICY "portfolio_owner_write"         ON freelance_portfolio_items
  FOR ALL USING (fn_owns_freelance_profile(profile_id));

-- ════════════════════════════════════════════
-- 19. REVIEW REPLIES
--     Lecture publique (réponse du freelance visible sur les pages service).
--     Écriture réservée à l'auteur (= le freelance qui répond).
-- ════════════════════════════════════════════
ALTER TABLE review_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_replies_public_select" ON review_replies
  FOR SELECT USING (TRUE);

CREATE POLICY "review_replies_author_write" ON review_replies
  FOR ALL USING (author_id = auth.uid());

-- ════════════════════════════════════════════
-- 20. SERVICE TAGS
--     Lecture publique. Écriture réservée au freelance propriétaire du service.
-- ════════════════════════════════════════════
ALTER TABLE service_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_tags_public_select" ON service_tags
  FOR SELECT USING (TRUE);

CREATE POLICY "service_tags_owner_write" ON service_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM services s
      JOIN freelance_profiles fp ON fp.id = s.freelance_id
      WHERE s.id = service_tags.service_id AND fp.profile_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════
-- 21. POST CATEGORIES
--     Lecture publique. Écriture admin uniquement.
-- ════════════════════════════════════════════
ALTER TABLE post_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_categories_public_select" ON post_categories
  FOR SELECT USING (TRUE);

CREATE POLICY "post_categories_admin_write" ON post_categories
  FOR ALL USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 22. POST TAGS
--     Lecture publique. Écriture réservée à l'auteur du post ou admin.
-- ════════════════════════════════════════════
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_tags_public_select" ON post_tags
  FOR SELECT USING (TRUE);

CREATE POLICY "post_tags_author_write" ON post_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_tags.post_id AND p.author_id = auth.uid()
    )
  );

CREATE POLICY "post_tags_admin_write" ON post_tags
  FOR ALL USING (fn_is_admin());
