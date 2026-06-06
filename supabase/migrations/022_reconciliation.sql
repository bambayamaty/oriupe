-- ════════════════════════════════════════════════════════════════════
-- 022_reconciliation.sql
--
-- Objectif : aligner le schéma Supabase avec le frontend Oriupe.
--
-- Règles :
--   ✔  ADDITIF — rien n'est supprimé ni modifié
--   ✔  IDEMPOTENT — peut être rejoué sans erreur
--   ✔  Source de vérité = les 12 tables déjà en production
--   ✔  On ajoute ce qui manque, pas plus
-- ════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 1 : colonnes manquantes dans `profiles`
--
-- La table existe déjà. On ajoute juste les champs que le frontend
-- utilise mais qui n'ont pas encore été créés.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'banned')),

  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'submitted', 'approved', 'rejected')),

  ADD COLUMN IF NOT EXISTS city     TEXT,
  ADD COLUMN IF NOT EXISTS phone    TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'XOF';


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 2 : categories
--
-- Référentiel des catégories de services et projets.
-- Utilisé par le catalogue, les filtres, et le formulaire de création.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  name_fr    TEXT NOT NULL,
  name_en    TEXT,
  icon       TEXT,
  sort_order INT  NOT NULL DEFAULT 0,
  is_active  BOOL NOT NULL DEFAULT true
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les catégories
CREATE POLICY "categories_read_all"
  ON categories FOR SELECT USING (true);

-- Données initiales (ON CONFLICT = idempotent)
INSERT INTO categories (slug, name_fr, name_en, icon, sort_order) VALUES
  ('dev-web-mobile',  'Dev. Web & Mobile',      'Web & Mobile Dev',    '💻', 1),
  ('design-ux',       'Design & UX/UI',          'Design & UX/UI',      '🎨', 2),
  ('marketing',       'Marketing Digital',       'Digital Marketing',   '📢', 3),
  ('redaction',       'Rédaction & Contenu',     'Writing & Content',   '✍️', 4),
  ('video-motion',    'Vidéo & Motion',          'Video & Motion',      '🎬', 5),
  ('finance-compta',  'Finance & Comptabilité',  'Finance & Accounting','💰', 6),
  ('formation',       'Formation & Coaching',    'Training & Coaching', '🎓', 7),
  ('audio-musique',   'Audio & Musique',         'Audio & Music',       '🎵', 8)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 3 : freelance_profiles
--
-- Extension de `profiles` pour les données spécifiques aux freelances :
-- slug public, titre professionnel, niveau de commission, statistiques.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS freelance_profiles (
  -- Clé = même ID que profiles (relation 1-1)
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- URL publique du freelance : /freelances/kofi-asante
  slug TEXT UNIQUE,

  professional_title TEXT,

  -- Niveau détermine le taux de commission
  --   new/confirmed → 12%  |  expert → 10%
  --   top_oriupe    →  8%  |  elite  →  5%
  level TEXT NOT NULL DEFAULT 'new'
    CHECK (level IN ('new', 'confirmed', 'expert', 'top_oriupe', 'elite')),

  -- Stats mises à jour par triggers ou fonctions backend
  avg_rating       NUMERIC(3,2) DEFAULT 0,
  review_count     INT          DEFAULT 0,
  completed_orders INT          DEFAULT 0,
  response_time_h  INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE freelance_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_public_read"
  ON freelance_profiles FOR SELECT USING (true);

CREATE POLICY "fp_owner_write"
  ON freelance_profiles FOR ALL
  USING (profile_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 4 : service_packages
--
-- Packages d'un service : Basique / Standard / Premium.
-- Plus flexible que les colonnes price_basic/standard/premium de `services`.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_packages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id   UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,          -- 'Basique', 'Standard', 'Premium'
  description  TEXT,
  price        INT  NOT NULL CHECK (price >= 0),
  delivery_days INT NOT NULL DEFAULT 7,
  revisions    INT NOT NULL DEFAULT 1,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_public_read"
  ON service_packages FOR SELECT USING (true);

CREATE POLICY "sp_owner_write"
  ON service_packages FOR ALL
  USING (
    service_id IN (
      SELECT id FROM services WHERE freelance_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 5 : service_media
--
-- Images et vidéos de la galerie d'un service.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_media (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image', 'video')),
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smed_public_read"
  ON service_media FOR SELECT USING (true);

CREATE POLICY "smed_owner_write"
  ON service_media FOR ALL
  USING (
    service_id IN (
      SELECT id FROM services WHERE freelance_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 6 : project_proposals
--
-- Candidatures des freelances aux appels d'offres.
-- Un freelance ne peut postuler qu'une seule fois par projet.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  freelance_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message         TEXT CHECK (char_length(message) <= 3000),
  proposed_amount INT  CHECK (proposed_amount > 0),
  proposed_days   INT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, freelance_id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_project  ON project_proposals (project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_freelance ON project_proposals (freelance_id);

ALTER TABLE project_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pp_freelance_can_submit"
  ON project_proposals FOR INSERT
  WITH CHECK (freelance_id = auth.uid());

CREATE POLICY "pp_participants_can_read"
  ON project_proposals FOR SELECT
  USING (
    freelance_id = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE client_id = auth.uid())
  );

CREATE POLICY "pp_freelance_can_update"
  ON project_proposals FOR UPDATE
  USING (freelance_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 7 : notifications
--
-- Notifications temps réel pour les utilisateurs.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,  -- 'order_update', 'new_message', 'payment', 'kyc', etc.
  title      TEXT NOT NULL,
  body       TEXT,
  data       JSONB DEFAULT '{}',   -- données liées : order_id, sender, etc.
  is_read    BOOL NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour récupérer rapidement les notifs non lues d'un user
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications (user_id) WHERE NOT is_read;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_owner_only"
  ON notifications FOR ALL
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 8 : favoris
--
-- Services et projets sauvegardés par les utilisateurs.
-- Clé composite (user_id, service_id) = pas de doublon possible.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS favorite_services (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, service_id)
);

ALTER TABLE favorite_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fav_svc_owner_only"
  ON favorite_services FOR ALL
  USING (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS favorite_projects (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE favorite_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fav_proj_owner_only"
  ON favorite_projects FOR ALL
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 9 : kyc_cases
--
-- Dossiers de vérification d'identité.
-- Un utilisateur = un seul dossier KYC (UNIQUE sur user_id).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_cases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  document_type    TEXT
    CHECK (document_type IN ('id_card', 'passport', 'residence_permit', 'driver_license')),
  document_front   TEXT,    -- chemin Storage
  document_back    TEXT,    -- chemin Storage
  selfie_url       TEXT,    -- chemin Storage
  submitted_at     TIMESTAMPTZ,
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kyc_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_owner_read"
  ON kyc_cases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "kyc_owner_submit"
  ON kyc_cases FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "kyc_owner_update_pending"
  ON kyc_cases FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending');


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 10 : fonctions utilitaires
-- ─────────────────────────────────────────────────────────────────────

-- Vérifie si l'utilisateur connecté est admin (utilisé dans les RLS admin)
CREATE OR REPLACE FUNCTION fn_is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid()
  );
$$;

-- Met à jour `updated_at` automatiquement sur les modifications
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- SECTION 11 : triggers updated_at
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_fp_updated_at
  BEFORE UPDATE ON freelance_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_pp_updated_at
  BEFORE UPDATE ON project_proposals
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
