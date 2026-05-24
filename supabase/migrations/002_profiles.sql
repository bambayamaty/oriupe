-- ═══════════════════════════════════════════════════════════════════
-- 002_profiles.sql — Profils utilisateurs
-- Dépend de : 001_enums.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── profiles : table centrale, 1:1 avec auth.users ──────────────────
CREATE TABLE profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identité
  first_name          TEXT        NOT NULL DEFAULT '',
  last_name           TEXT        NOT NULL DEFAULT '',
  email               TEXT        NOT NULL,
  phone               TEXT,
  avatar_url          TEXT,

  -- Rôle & statut
  role                user_role   NOT NULL DEFAULT 'client',
  account_type        account_type NOT NULL DEFAULT 'individual',
  account_status      account_status NOT NULL DEFAULT 'pending_kyc',

  -- KYC résumé (détail dans kyc_cases)
  kyc_status          kyc_status  NOT NULL DEFAULT 'not_submitted',
  is_kyc_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
  kyc_verified_at     TIMESTAMPTZ,

  -- Localisation & préférences
  country_code        CHAR(2),                        -- ISO 3166-1 alpha-2
  city                TEXT,
  language            VARCHAR(5)  DEFAULT 'fr',        -- BCP 47
  currency            currency_code NOT NULL DEFAULT 'XOF',
  timezone            TEXT        DEFAULT 'Africa/Abidjan',

  -- Sécurité & modération
  suspended_until     TIMESTAMPTZ,
  suspension_reason   TEXT,
  banned_at           TIMESTAMPTZ,
  ban_reason          TEXT,

  -- Double rôle (client peut aussi être freelance et vice-versa)
  has_both_roles      BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Préférences
  email_notifications BOOLEAN     NOT NULL DEFAULT TRUE,
  sms_notifications   BOOLEAN     NOT NULL DEFAULT FALSE,
  marketing_emails    BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Métadonnées
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ
);

-- Index critiques
CREATE INDEX idx_profiles_role    ON profiles(role);
CREATE INDEX idx_profiles_status  ON profiles(account_status);
CREATE INDEX idx_profiles_kyc     ON profiles(kyc_status);
CREATE INDEX idx_profiles_country ON profiles(country_code);

-- ── client_profiles : données spécifiques aux clients ───────────────
CREATE TABLE client_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Entreprise (si account_type = 'business')
  company_name        TEXT,
  company_sector      TEXT,
  company_size        TEXT,
  company_website     TEXT,

  -- Facturation
  billing_name        TEXT,
  billing_address     TEXT,
  billing_city        TEXT,
  billing_country     CHAR(2),
  billing_tax_id      TEXT,           -- RCCM / SIRET / IFU etc.

  -- Stats
  total_spent         BIGINT      NOT NULL DEFAULT 0  CHECK (total_spent >= 0),
  total_orders        INT         NOT NULL DEFAULT 0  CHECK (total_orders >= 0),
  active_orders       INT         NOT NULL DEFAULT 0  CHECK (active_orders >= 0),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── freelance_profiles : données spécifiques aux freelances ─────────
CREATE TABLE freelance_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Identité professionnelle
  slug                TEXT        NOT NULL UNIQUE,    -- URL publique : /p/{slug}
  professional_title  TEXT        NOT NULL DEFAULT '',
  bio                 TEXT,
  bio_short           TEXT,       -- max 160 chars

  -- Catégorie
  category_id         UUID        REFERENCES categories(id),
  subcategory_id      UUID        REFERENCES subcategories(id),

  -- Disponibilité
  availability        availability_status NOT NULL DEFAULT 'available',
  response_time_hours INT         DEFAULT 24,         -- délai réponse estimé

  -- Niveau & réputation
  level               freelance_level NOT NULL DEFAULT 'new',
  avg_rating          NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (avg_rating BETWEEN 0 AND 5),
  review_count        INT         NOT NULL DEFAULT 0  CHECK (review_count >= 0),
  completed_orders    INT         NOT NULL DEFAULT 0  CHECK (completed_orders >= 0),

  -- Revenus (en centimes pour éviter les flottants)
  total_revenue_cents BIGINT      NOT NULL DEFAULT 0  CHECK (total_revenue_cents >= 0),
  pending_payout_cents BIGINT     NOT NULL DEFAULT 0  CHECK (pending_payout_cents >= 0),

  -- Mobile Money (paiement des revenus)
  payout_operator     payment_operator,
  payout_phone        TEXT,

  -- Visibilité
  is_public           BOOLEAN     NOT NULL DEFAULT TRUE,
  is_featured         BOOLEAN     NOT NULL DEFAULT FALSE,  -- mis en avant par admin

  -- Métadonnées
  profile_views       INT         NOT NULL DEFAULT 0,
  last_active_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_freelance_slug      ON freelance_profiles(slug);
CREATE INDEX idx_freelance_category  ON freelance_profiles(category_id);
CREATE INDEX idx_freelance_level     ON freelance_profiles(level);
CREATE INDEX idx_freelance_rating    ON freelance_profiles(avg_rating DESC);
CREATE INDEX idx_freelance_public    ON freelance_profiles(is_public) WHERE is_public = TRUE;

-- ── Tables freelance associées ───────────────────────────────────────

CREATE TABLE freelance_skills (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID    NOT NULL REFERENCES freelance_profiles(id) ON DELETE CASCADE,
  skill_id        UUID    REFERENCES skills(id),
  skill_name      TEXT    NOT NULL,   -- dénormalisé pour performance
  level           TEXT    CHECK (level IN ('débutant','intermédiaire','expert')),
  sort_order      INT     NOT NULL DEFAULT 0
);
CREATE INDEX idx_fskills_profile ON freelance_skills(profile_id);

CREATE TABLE freelance_languages (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID    NOT NULL REFERENCES freelance_profiles(id) ON DELETE CASCADE,
  language_code   VARCHAR(5) NOT NULL,   -- BCP 47 (fr, en, ar, sw...)
  language_name   TEXT    NOT NULL,
  proficiency     TEXT    CHECK (proficiency IN ('courant','avancé','natif'))
);
CREATE INDEX idx_flang_profile ON freelance_languages(profile_id);

CREATE TABLE freelance_portfolio_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID        NOT NULL REFERENCES freelance_profiles(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT,
  url             TEXT,
  image_url       TEXT,
  category        TEXT,
  tags            TEXT[],
  sort_order      INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_portfolio_profile ON freelance_portfolio_items(profile_id);

CREATE TABLE freelance_experiences (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID        NOT NULL REFERENCES freelance_profiles(id) ON DELETE CASCADE,
  company         TEXT        NOT NULL,
  role            TEXT        NOT NULL,
  description     TEXT,
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE freelance_certifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID        NOT NULL REFERENCES freelance_profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  issuer          TEXT,
  issued_at       DATE,
  expires_at      DATE,
  credential_url  TEXT,
  verified        BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ── Trigger : updated_at automatique ────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_client_profiles_updated_at
  BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_freelance_profiles_updated_at
  BEFORE UPDATE ON freelance_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
