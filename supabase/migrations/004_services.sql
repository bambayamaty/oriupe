-- ═══════════════════════════════════════════════════════════════════
-- 004_services.sql — Services freelance
-- Dépend de : 002_profiles.sql, 003_referentials.sql
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE services (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  freelance_id        UUID        NOT NULL REFERENCES freelance_profiles(id) ON DELETE CASCADE,
  category_id         UUID        REFERENCES categories(id),
  subcategory_id      UUID        REFERENCES subcategories(id),

  -- Contenu
  title               TEXT        NOT NULL,
  slug                TEXT        UNIQUE,                   -- généré par fn_generate_service_slug
  description         TEXT        NOT NULL DEFAULT '',
  short_description   TEXT,       -- max 120 chars

  -- Prix de base (package Basique)
  base_price_cents    BIGINT      NOT NULL CHECK (base_price_cents > 0),
  currency            currency_code NOT NULL DEFAULT 'XOF',

  -- Délai de base (jours)
  base_delivery_days  INT         NOT NULL DEFAULT 7 CHECK (base_delivery_days > 0),

  -- Révisions incluses (package Basique)
  base_revisions      INT         NOT NULL DEFAULT 1 CHECK (base_revisions >= 0),

  -- Statut
  status              service_status NOT NULL DEFAULT 'draft',
  rejection_reason    TEXT,
  published_at        TIMESTAMPTZ,
  paused_at           TIMESTAMPTZ,

  -- Stats
  view_count          INT         NOT NULL DEFAULT 0,
  order_count         INT         NOT NULL DEFAULT 0,
  avg_rating          NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (avg_rating BETWEEN 0 AND 5),
  review_count        INT         NOT NULL DEFAULT 0,
  favorite_count      INT         NOT NULL DEFAULT 0,

  -- SEO
  meta_title          TEXT,
  meta_description    TEXT,
  search_vector       TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('french', coalesce(title,'') || ' ' || coalesce(short_description,'') || ' ' || coalesce(description,''))
  ) STORED,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_freelance ON services(freelance_id);
CREATE INDEX idx_services_status    ON services(status);
CREATE INDEX idx_services_category  ON services(category_id);
CREATE INDEX idx_services_search    ON services USING GIN(search_vector);
CREATE INDEX idx_services_published ON services(published_at DESC) WHERE status = 'published';

-- ── Packages d'un service (Basique / Standard / Premium) ────────────
CREATE TABLE service_packages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,           -- 'Basique', 'Standard', 'Premium'
  description     TEXT,
  price_cents     BIGINT      NOT NULL CHECK (price_cents > 0),
  delivery_days   INT         NOT NULL CHECK (delivery_days > 0),
  revisions       INT         NOT NULL DEFAULT 1,
  sort_order      INT         NOT NULL DEFAULT 0,  -- 0=Basique, 1=Standard, 2=Premium
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_pkg_service ON service_packages(service_id);

CREATE TABLE service_package_features (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id  UUID    NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
  feature     TEXT    NOT NULL,
  included    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT     NOT NULL DEFAULT 0
);

-- ── Médias du service ────────────────────────────────────────────────
CREATE TABLE service_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  storage_path TEXT,       -- chemin dans Supabase Storage
  type        TEXT        CHECK (type IN ('image','video','document')),
  is_cover    BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_media_service ON service_media(service_id);

-- ── FAQ du service ───────────────────────────────────────────────────
CREATE TABLE service_faqs (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID    NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  question    TEXT    NOT NULL,
  answer      TEXT    NOT NULL,
  sort_order  INT     NOT NULL DEFAULT 0
);

-- ── Extras / options supplémentaires ────────────────────────────────
CREATE TABLE service_extras (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID    NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  description     TEXT,
  price_cents     BIGINT  NOT NULL CHECK (price_cents > 0),
  delivery_days   INT     NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Tags du service ──────────────────────────────────────────────────
CREATE TABLE service_tags (
  service_id  UUID    NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  tag_id      UUID    NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, tag_id)
);

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Fonction : génération de slug service ───────────────────────────
CREATE OR REPLACE FUNCTION fn_generate_service_slug(title TEXT, freelance_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  -- Translittération simple + nettoyage
  base_slug := lower(regexp_replace(
    translate(title,
      'àáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝÞŸ',
      'aaaaaaaceeeeiiiidnoooooouuuuyttyaaaaaaaaaceeeeiiiidnoooooouuuuytty'
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 60);

  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM services WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;
