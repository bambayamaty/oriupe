-- ═══════════════════════════════════════════════════════════════════
-- 009_social.sql — Avis, Favoris, Publications
-- Dépend de : 002_profiles.sql, 004_services.sql, 005_projects.sql, 006_orders_escrow.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── reviews : avis post-commande ─────────────────────────────────────
CREATE TABLE reviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  service_id      UUID        REFERENCES services(id),
  freelance_id    UUID        NOT NULL REFERENCES freelance_profiles(id),
  author_id       UUID        NOT NULL REFERENCES profiles(id),

  -- Note globale
  rating          INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),

  -- Notes détaillées (optionnelles)
  rating_quality      INT     CHECK (rating_quality BETWEEN 1 AND 5),
  rating_communication INT    CHECK (rating_communication BETWEEN 1 AND 5),
  rating_deadline     INT     CHECK (rating_deadline BETWEEN 1 AND 5),

  -- Contenu
  comment         TEXT,
  is_public       BOOLEAN     NOT NULL DEFAULT TRUE,
  is_verified     BOOLEAN     NOT NULL DEFAULT TRUE,  -- avis vérifié = lié à une commande

  -- Modération
  is_flagged      BOOLEAN     NOT NULL DEFAULT FALSE,
  flag_reason     TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un seul avis par commande
  CONSTRAINT uq_review_order UNIQUE (order_id, author_id)
);

CREATE INDEX idx_reviews_freelance ON reviews(freelance_id);
CREATE INDEX idx_reviews_service   ON reviews(service_id);
CREATE INDEX idx_reviews_author    ON reviews(author_id);

-- Contrainte: avis seulement sur commandes completed
-- (vérifiée via RPC fn_leave_review)

-- ── review_replies : réponse du freelance ────────────────────────────
CREATE TABLE review_replies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID        NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES profiles(id),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Trigger: met à jour avg_rating du freelance ──────────────────────
CREATE OR REPLACE FUNCTION fn_update_freelance_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_freelance_id UUID;
BEGIN
  target_freelance_id := COALESCE(NEW.freelance_id, OLD.freelance_id);

  UPDATE freelance_profiles
  SET
    avg_rating   = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE freelance_id = target_freelance_id AND is_public = TRUE),
    review_count = (SELECT COUNT(*) FROM reviews WHERE freelance_id = target_freelance_id AND is_public = TRUE)
  WHERE id = target_freelance_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_review_rating_sync
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION fn_update_freelance_rating();

-- ── Trigger: met à jour avg_rating du service ────────────────────────
CREATE OR REPLACE FUNCTION fn_update_service_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(NEW.service_id, OLD.service_id) IS NOT NULL THEN
    UPDATE services
    SET
      avg_rating   = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE service_id = COALESCE(NEW.service_id, OLD.service_id) AND is_public = TRUE),
      review_count = (SELECT COUNT(*) FROM reviews WHERE service_id = COALESCE(NEW.service_id, OLD.service_id) AND is_public = TRUE),
      order_count  = order_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE 0 END
    WHERE id = COALESCE(NEW.service_id, OLD.service_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_review_service_rating_sync
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION fn_update_service_rating();

-- ── Favoris ──────────────────────────────────────────────────────────

CREATE TABLE favorite_services (
  user_id     UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id  UUID    NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, service_id)
);
CREATE INDEX idx_fav_services_user    ON favorite_services(user_id);
CREATE INDEX idx_fav_services_service ON favorite_services(service_id);

CREATE TABLE favorite_projects (
  user_id     UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE saved_freelances (
  user_id         UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  freelance_id    UUID    NOT NULL REFERENCES freelance_profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, freelance_id)
);

-- Trigger: compteur de favoris sur les services
CREATE OR REPLACE FUNCTION fn_sync_service_favorite_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE services
  SET favorite_count = (
    SELECT COUNT(*) FROM favorite_services WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
  )
  WHERE id = COALESCE(NEW.service_id, OLD.service_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_favorite_service_count
  AFTER INSERT OR DELETE ON favorite_services
  FOR EACH ROW EXECUTE FUNCTION fn_sync_service_favorite_count();

-- ── Publications (Blog / Academy / Guides / News) ────────────────────

CREATE TABLE post_categories (
  id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug    TEXT    NOT NULL UNIQUE,
  name_fr TEXT    NOT NULL,
  name_en TEXT,
  type    post_type NOT NULL DEFAULT 'blog'
);

CREATE TABLE posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID        NOT NULL REFERENCES profiles(id),
  category_id     UUID        REFERENCES post_categories(id),

  type            post_type   NOT NULL DEFAULT 'blog',
  status          post_status NOT NULL DEFAULT 'draft',

  title           TEXT        NOT NULL,
  slug            TEXT        NOT NULL UNIQUE,
  excerpt         TEXT,
  content         TEXT,
  cover_url       TEXT,
  storage_path    TEXT,

  -- SEO
  meta_title      TEXT,
  meta_description TEXT,

  -- Stats
  view_count      INT         NOT NULL DEFAULT 0,

  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_status    ON posts(status);
CREATE INDEX idx_posts_type      ON posts(type);
CREATE INDEX idx_posts_published ON posts(published_at DESC) WHERE status = 'published';

CREATE TABLE post_tags (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
