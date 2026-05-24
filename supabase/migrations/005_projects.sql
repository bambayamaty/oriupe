-- ═══════════════════════════════════════════════════════════════════
-- 005_projects.sql — Projets clients & Propositions freelance
-- Dépend de : 002_profiles.sql, 003_referentials.sql
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE projects (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_freelance_id UUID       REFERENCES freelance_profiles(id),

  -- Contenu
  title               TEXT        NOT NULL,
  slug                TEXT        UNIQUE,
  description         TEXT        NOT NULL,
  requirements        TEXT,

  -- Catégorie
  category_id         UUID        REFERENCES categories(id),
  subcategory_id      UUID        REFERENCES subcategories(id),

  -- Budget (en centimes pour précision)
  budget_min_cents    BIGINT      CHECK (budget_min_cents >= 0),
  budget_max_cents    BIGINT      CHECK (budget_max_cents >= 0),
  currency            currency_code NOT NULL DEFAULT 'XOF',

  -- Délai souhaité
  deadline            DATE,
  duration_days       INT         CHECK (duration_days > 0),

  -- Type & statut
  type                project_type    NOT NULL DEFAULT 'public_tender',
  status              project_status  NOT NULL DEFAULT 'draft',
  rejection_reason    TEXT,

  -- Ciblage direct (type = 'direct_order')
  target_freelance_id UUID        REFERENCES freelance_profiles(id),

  -- Stats
  view_count          INT         NOT NULL DEFAULT 0,
  proposal_count      INT         NOT NULL DEFAULT 0,

  -- Full-text search
  search_vector       TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('french', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(requirements,''))
  ) STORED,

  -- Dates
  published_at        TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_client    ON projects(client_id);
CREATE INDEX idx_projects_status    ON projects(status);
CREATE INDEX idx_projects_category  ON projects(category_id);
CREATE INDEX idx_projects_search    ON projects USING GIN(search_vector);
CREATE INDEX idx_projects_open      ON projects(published_at DESC) WHERE status = 'open';

-- ── Compétences requises pour un projet ─────────────────────────────
CREATE TABLE project_skills (
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_id    UUID    REFERENCES skills(id),
  skill_name  TEXT    NOT NULL,
  PRIMARY KEY (project_id, skill_name)
);

-- ── Fichiers joints au projet (briefs, specs) ───────────────────────
CREATE TABLE project_files (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  url             TEXT        NOT NULL,
  storage_path    TEXT,
  size_bytes      BIGINT,
  mime_type       TEXT,
  uploaded_by     UUID        NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pfiles_project ON project_files(project_id);

-- ── Invitations directes (pour type = 'direct_order') ───────────────
CREATE TABLE project_invitations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  freelance_id    UUID        NOT NULL REFERENCES freelance_profiles(id),
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  message         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, freelance_id)
);

-- ── Propositions freelance ───────────────────────────────────────────
CREATE TABLE project_proposals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  freelance_id    UUID        NOT NULL REFERENCES freelance_profiles(id) ON DELETE CASCADE,

  -- Contenu
  cover_letter    TEXT        NOT NULL,
  proposed_amount_cents BIGINT NOT NULL CHECK (proposed_amount_cents > 0),
  proposed_days   INT         NOT NULL CHECK (proposed_days > 0),
  currency        currency_code NOT NULL DEFAULT 'XOF',

  -- Statut
  status          proposal_status NOT NULL DEFAULT 'pending',
  client_note     TEXT,           -- note interne du client sur la proposition

  -- Empêcher double candidature
  UNIQUE (project_id, freelance_id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposals_project  ON project_proposals(project_id);
CREATE INDEX idx_proposals_freelance ON project_proposals(freelance_id);
CREATE INDEX idx_proposals_status   ON project_proposals(status);

-- Contrainte: on ne peut candidater que sur des projets ouverts
-- (vérifiée côté RPC fn_submit_proposal)

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_proposals_updated_at
  BEFORE UPDATE ON project_proposals
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Compteur automatique des propositions ───────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_proposal_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE projects
  SET proposal_count = (
    SELECT COUNT(*) FROM project_proposals
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
    AND status NOT IN ('withdrawn')
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_proposal_count_sync
  AFTER INSERT OR UPDATE OR DELETE ON project_proposals
  FOR EACH ROW EXECUTE FUNCTION fn_sync_proposal_count();

-- ── Fonction : génération de slug projet ────────────────────────────
CREATE OR REPLACE FUNCTION fn_generate_project_slug(title TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
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
  WHILE EXISTS (SELECT 1 FROM projects WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;
