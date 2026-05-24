-- ═══════════════════════════════════════════════════════════════════
-- 012_rls_policies.sql — Row Level Security complètes
-- PRINCIPE: deny-by-default. On active RLS puis on whiteliste.
-- ═══════════════════════════════════════════════════════════════════

-- ── Helper: vérifier si l'utilisateur est admin ──────────────────────
CREATE OR REPLACE FUNCTION fn_is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_roles
    WHERE profile_id = uid AND is_active = TRUE
  );
$$;

-- Helper: vérifier un rôle admin spécifique
CREATE OR REPLACE FUNCTION fn_has_admin_role(required_role admin_role, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_roles
    WHERE profile_id = uid
      AND (role = required_role OR role = 'super_admin')
      AND is_active = TRUE
  );
$$;

-- Helper: vérifier si l'user est participant d'une conversation
CREATE OR REPLACE FUNCTION fn_is_conversation_participant(conv_id UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id AND user_id = uid AND left_at IS NULL
  );
$$;

-- ════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Chaque user lit son propre profil
CREATE POLICY profiles_select_own
  ON profiles FOR SELECT USING (id = auth.uid());

-- Les profils publics des freelances sont visibles par tout le monde
CREATE POLICY profiles_select_public_freelance
  ON profiles FOR SELECT
  USING (role = 'freelance' AND account_status = 'active');

-- Admin peut tout voir
CREATE POLICY profiles_select_admin
  ON profiles FOR SELECT USING (fn_is_admin());

-- Un user ne modifie que son propre profil
CREATE POLICY profiles_update_own
  ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Admin peut modifier
CREATE POLICY profiles_update_admin
  ON profiles FOR UPDATE USING (fn_is_admin());

-- ════════════════════════════════════════════
-- CLIENT_PROFILES & FREELANCE_PROFILES
-- ════════════════════════════════════════════
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_profiles_select_own
  ON client_profiles FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY client_profiles_update_own
  ON client_profiles FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY client_profiles_admin
  ON client_profiles FOR ALL USING (fn_is_admin());

ALTER TABLE freelance_profiles ENABLE ROW LEVEL SECURITY;

-- Freelance public visible par tous
CREATE POLICY freelance_profiles_select_published
  ON freelance_profiles FOR SELECT
  USING (is_public = TRUE AND (SELECT account_status FROM profiles WHERE id = profile_id) = 'active');

CREATE POLICY freelance_profiles_select_own
  ON freelance_profiles FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY freelance_profiles_update_own
  ON freelance_profiles FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY freelance_profiles_admin
  ON freelance_profiles FOR ALL USING (fn_is_admin());

-- ════════════════════════════════════════════
-- SERVICES
-- ════════════════════════════════════════════
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Services publiés visibles publiquement
CREATE POLICY services_select_published
  ON services FOR SELECT
  USING (status = 'published');

-- Le freelance voit tous ses services (draft, paused, etc.)
CREATE POLICY services_select_own
  ON services FOR SELECT
  USING (freelance_id = (SELECT id FROM freelance_profiles WHERE profile_id = auth.uid()));

-- Admin voit tout
CREATE POLICY services_select_admin
  ON services FOR SELECT USING (fn_is_admin());

-- Le freelance modifie ses propres services (sauf published → needs re-review)
CREATE POLICY services_insert_own
  ON services FOR INSERT
  WITH CHECK (freelance_id = (SELECT id FROM freelance_profiles WHERE profile_id = auth.uid()));

CREATE POLICY services_update_own
  ON services FOR UPDATE
  USING (freelance_id = (SELECT id FROM freelance_profiles WHERE profile_id = auth.uid()));

CREATE POLICY services_delete_own
  ON services FOR DELETE
  USING (
    freelance_id = (SELECT id FROM freelance_profiles WHERE profile_id = auth.uid())
    AND status IN ('draft','paused','archived')
  );

CREATE POLICY services_admin_all
  ON services FOR ALL USING (fn_is_admin());

-- Même logique pour les tables liées
ALTER TABLE service_packages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_package_features  ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_media             ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_faqs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_extras            ENABLE ROW LEVEL SECURITY;

-- Lecture publique si service publié
CREATE POLICY svc_pkg_select_published
  ON service_packages FOR SELECT
  USING (EXISTS (SELECT 1 FROM services WHERE id = service_id AND status = 'published'));

CREATE POLICY svc_pkg_select_own
  ON service_packages FOR SELECT
  USING (EXISTS (SELECT 1 FROM services s JOIN freelance_profiles fp ON fp.id = s.freelance_id
    WHERE s.id = service_id AND fp.profile_id = auth.uid()));

CREATE POLICY svc_pkg_write_own
  ON service_packages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM services s JOIN freelance_profiles fp ON fp.id = s.freelance_id
    WHERE s.id = service_id AND fp.profile_id = auth.uid()));

CREATE POLICY svc_pkg_update_own
  ON service_packages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM services s JOIN freelance_profiles fp ON fp.id = s.freelance_id
    WHERE s.id = service_id AND fp.profile_id = auth.uid()));

-- ════════════════════════════════════════════
-- PROJECTS
-- ════════════════════════════════════════════
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Projets ouverts visibles par tous les freelances vérifiés
CREATE POLICY projects_select_open
  ON projects FOR SELECT
  USING (
    status = 'open'
    AND (
      type = 'public_tender'
      OR (type = 'direct_order' AND target_freelance_id = (SELECT id FROM freelance_profiles WHERE profile_id = auth.uid()))
    )
  );

-- Le client voit tous ses projets
CREATE POLICY projects_select_own
  ON projects FOR SELECT USING (client_id = auth.uid());

-- Admin
CREATE POLICY projects_select_admin
  ON projects FOR SELECT USING (fn_is_admin());

CREATE POLICY projects_insert_client
  ON projects FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY projects_update_own
  ON projects FOR UPDATE USING (client_id = auth.uid());

ALTER TABLE project_proposals ENABLE ROW LEVEL SECURITY;

-- Le freelance voit ses propres propositions
CREATE POLICY proposals_select_own_freelance
  ON project_proposals FOR SELECT
  USING (freelance_id = (SELECT id FROM freelance_profiles WHERE profile_id = auth.uid()));

-- Le client voit toutes les propositions sur ses projets
CREATE POLICY proposals_select_client
  ON project_proposals FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND client_id = auth.uid()));

CREATE POLICY proposals_insert_freelance
  ON project_proposals FOR INSERT
  WITH CHECK (freelance_id = (SELECT id FROM freelance_profiles WHERE profile_id = auth.uid()));

CREATE POLICY proposals_update_own_freelance
  ON project_proposals FOR UPDATE
  USING (freelance_id = (SELECT id FROM freelance_profiles WHERE profile_id = auth.uid()));

CREATE POLICY proposals_admin
  ON project_proposals FOR ALL USING (fn_is_admin());

-- ════════════════════════════════════════════
-- ORDERS & ESCROW
-- ════════════════════════════════════════════
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Client voit ses commandes
CREATE POLICY orders_select_client
  ON orders FOR SELECT USING (client_id = auth.uid());

-- Freelance voit ses commandes
CREATE POLICY orders_select_freelance
  ON orders FOR SELECT
  USING (freelance_id = (SELECT id FROM freelance_profiles WHERE profile_id = auth.uid()));

-- Finance + Admin voient tout
CREATE POLICY orders_select_finance
  ON orders FOR SELECT
  USING (fn_has_admin_role('finance') OR fn_has_admin_role('super_admin') OR fn_has_admin_role('admin'));

-- Aucun INSERT direct (passe par les RPC)
-- Aucun UPDATE direct par les users (passe par les RPC)

ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY escrow_select_client
  ON escrow_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE id = order_id AND client_id = auth.uid()));

CREATE POLICY escrow_select_freelance
  ON escrow_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o JOIN freelance_profiles fp ON fp.id = o.freelance_id
    WHERE o.id = order_id AND fp.profile_id = auth.uid()
  ));

CREATE POLICY escrow_select_finance
  ON escrow_transactions FOR SELECT
  USING (fn_has_admin_role('finance') OR fn_has_admin_role('super_admin'));

ALTER TABLE order_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ose_select_parties
  ON order_status_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    LEFT JOIN freelance_profiles fp ON fp.id = o.freelance_id
    WHERE o.id = order_id
      AND (o.client_id = auth.uid() OR fp.profile_id = auth.uid())
  ));

CREATE POLICY ose_select_admin ON order_status_events FOR SELECT USING (fn_is_admin());

-- ════════════════════════════════════════════
-- MESSAGERIE
-- ════════════════════════════════════════════
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Un user ne voit que ses conversations
CREATE POLICY conversations_select_participant
  ON conversations FOR SELECT
  USING (fn_is_conversation_participant(id));

CREATE POLICY conversations_select_admin
  ON conversations FOR SELECT USING (fn_is_admin());

ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_select_own
  ON conversation_participants FOR SELECT
  USING (user_id = auth.uid() OR fn_is_conversation_participant(conversation_id));

CREATE POLICY cp_admin
  ON conversation_participants FOR ALL USING (fn_is_admin());

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Seulement les participants de la conversation voient les messages
CREATE POLICY messages_select_participants
  ON messages FOR SELECT
  USING (fn_is_conversation_participant(conversation_id));

CREATE POLICY messages_insert_participants
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND fn_is_conversation_participant(conversation_id)
  );

-- On peut seulement soft-delete/edit ses propres messages
CREATE POLICY messages_update_own
  ON messages FOR UPDATE
  USING (sender_id = auth.uid());

CREATE POLICY messages_select_admin
  ON messages FOR SELECT USING (fn_is_admin());

-- ════════════════════════════════════════════
-- KYC
-- ════════════════════════════════════════════
ALTER TABLE kyc_cases ENABLE ROW LEVEL SECURITY;

-- Propriétaire voit son dossier
CREATE POLICY kyc_select_own
  ON kyc_cases FOR SELECT USING (profile_id = auth.uid());

-- Modérateurs et admins voient tous les dossiers
CREATE POLICY kyc_select_admin
  ON kyc_cases FOR SELECT
  USING (fn_has_admin_role('moderator') OR fn_has_admin_role('super_admin') OR fn_has_admin_role('admin'));

CREATE POLICY kyc_update_own
  ON kyc_cases FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY kyc_update_admin
  ON kyc_cases FOR UPDATE
  USING (fn_has_admin_role('moderator') OR fn_has_admin_role('super_admin'));

ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY kycdocs_select_own
  ON kyc_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM kyc_cases WHERE id = kyc_case_id AND profile_id = auth.uid()));

CREATE POLICY kycdocs_select_admin
  ON kyc_documents FOR SELECT
  USING (fn_has_admin_role('moderator') OR fn_has_admin_role('super_admin'));

CREATE POLICY kycdocs_insert_own
  ON kyc_documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM kyc_cases WHERE id = kyc_case_id AND profile_id = auth.uid()));

ALTER TABLE kyc_reviews ENABLE ROW LEVEL SECURITY;

-- Lecture: propriétaire et admins
CREATE POLICY kycrev_select_own
  ON kyc_reviews FOR SELECT
  USING (EXISTS (SELECT 1 FROM kyc_cases WHERE id = kyc_case_id AND profile_id = auth.uid()));

CREATE POLICY kycrev_select_admin
  ON kyc_reviews FOR SELECT
  USING (fn_has_admin_role('moderator') OR fn_has_admin_role('super_admin'));

-- Seuls les admins peuvent écrire des reviews
CREATE POLICY kycrev_insert_admin
  ON kyc_reviews FOR INSERT
  WITH CHECK (fn_has_admin_role('moderator') OR fn_has_admin_role('super_admin'));

-- ════════════════════════════════════════════
-- REVIEWS
-- ════════════════════════════════════════════
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_select_public
  ON reviews FOR SELECT USING (is_public = TRUE);

CREATE POLICY reviews_select_own
  ON reviews FOR SELECT USING (author_id = auth.uid());

-- Avis seulement sur ses propres commandes completed (validation dans RPC)
CREATE POLICY reviews_insert_own
  ON reviews FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE id = order_id AND client_id = auth.uid() AND status = 'completed'
    )
  );

CREATE POLICY reviews_admin
  ON reviews FOR ALL USING (fn_is_admin());

-- ════════════════════════════════════════════
-- FAVORIS
-- ════════════════════════════════════════════
ALTER TABLE favorite_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY fav_services_own ON favorite_services FOR ALL USING (user_id = auth.uid());

ALTER TABLE favorite_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY fav_projects_own ON favorite_projects FOR ALL USING (user_id = auth.uid());

ALTER TABLE saved_freelances ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_freelances_own ON saved_freelances FOR ALL USING (user_id = auth.uid());

-- ════════════════════════════════════════════
-- LITIGES
-- ════════════════════════════════════════════
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY disputes_select_parties
  ON disputes FOR SELECT
  USING (
    opened_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM orders o JOIN freelance_profiles fp ON fp.id = o.freelance_id
      WHERE o.id = order_id
        AND (o.client_id = auth.uid() OR fp.profile_id = auth.uid())
    )
  );

CREATE POLICY disputes_select_support
  ON disputes FOR SELECT
  USING (fn_has_admin_role('support') OR fn_has_admin_role('super_admin') OR fn_has_admin_role('admin'));

CREATE POLICY disputes_insert_parties
  ON disputes FOR INSERT
  WITH CHECK (opened_by = auth.uid());

CREATE POLICY disputes_update_admin
  ON disputes FOR UPDATE
  USING (fn_has_admin_role('support') OR fn_has_admin_role('super_admin'));

ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY dispute_msg_select
  ON dispute_messages FOR SELECT
  USING (
    NOT is_internal  -- messages non-internes visibles par les parties
    AND EXISTS (
      SELECT 1 FROM disputes d
      JOIN orders o ON o.id = d.order_id
      LEFT JOIN freelance_profiles fp ON fp.id = o.freelance_id
      WHERE d.id = dispute_id
        AND (o.client_id = auth.uid() OR fp.profile_id = auth.uid() OR d.opened_by = auth.uid())
    )
    OR fn_has_admin_role('support') OR fn_has_admin_role('super_admin')
  );

-- ════════════════════════════════════════════
-- NOTIFICATIONS
-- ════════════════════════════════════════════
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_select_own
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notif_update_own
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Insertion par les fonctions SECURITY DEFINER uniquement (pas de INSERT direct)

-- ════════════════════════════════════════════
-- ADMIN
-- ════════════════════════════════════════════
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Admin voit ses propres logs; super_admin voit tout
CREATE POLICY admin_logs_own
  ON admin_action_logs FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY admin_logs_super
  ON admin_action_logs FOR SELECT USING (fn_has_admin_role('super_admin'));

ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY modqueue_select_admin
  ON moderation_queue FOR SELECT
  USING (fn_has_admin_role('moderator') OR fn_has_admin_role('support') OR fn_has_admin_role('super_admin') OR fn_has_admin_role('admin'));

CREATE POLICY modqueue_update_admin
  ON moderation_queue FOR UPDATE
  USING (fn_has_admin_role('moderator') OR fn_has_admin_role('support') OR fn_has_admin_role('super_admin'));

-- ════════════════════════════════════════════
-- POSTS
-- ════════════════════════════════════════════
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY posts_select_published
  ON posts FOR SELECT USING (status = 'published');

CREATE POLICY posts_select_own
  ON posts FOR SELECT USING (author_id = auth.uid());

CREATE POLICY posts_write_admin
  ON posts FOR ALL USING (fn_is_admin());

-- ════════════════════════════════════════════
-- RÉFÉRENTIELS (lecture publique, écriture admin)
-- ════════════════════════════════════════════
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_public   ON categories       FOR SELECT USING (is_active = TRUE);
CREATE POLICY subcategories_public ON subcategories   FOR SELECT USING (is_active = TRUE);
CREATE POLICY skills_public       ON skills           FOR SELECT USING (TRUE);
CREATE POLICY tags_public         ON tags             FOR SELECT USING (TRUE);
CREATE POLICY countries_public    ON countries        FOR SELECT USING (TRUE);
CREATE POLICY currencies_public   ON currencies       FOR SELECT USING (TRUE);
CREATE POLICY payment_methods_public ON payment_methods FOR SELECT USING (is_active = TRUE);

CREATE POLICY categories_admin    ON categories       FOR ALL USING (fn_is_admin());
CREATE POLICY subcategories_admin ON subcategories    FOR ALL USING (fn_is_admin());
CREATE POLICY skills_admin        ON skills           FOR ALL USING (fn_is_admin());
CREATE POLICY tags_admin          ON tags             FOR ALL USING (fn_is_admin());

-- Platform settings: lecture admin uniquement
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_admin ON platform_settings FOR ALL USING (fn_is_admin());
