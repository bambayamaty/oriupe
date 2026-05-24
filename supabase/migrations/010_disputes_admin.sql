-- ═══════════════════════════════════════════════════════════════════
-- 010_disputes_admin.sql — Litiges, Administration, Modération, Notifications
-- Dépend de : 002_profiles.sql, 006_orders_escrow.sql, 007_messaging.sql
-- ═══════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════
-- LITIGES
-- ════════════════════════════════════════════

CREATE TABLE disputes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  opened_by       UUID        NOT NULL REFERENCES profiles(id),
  assigned_to     UUID        REFERENCES profiles(id),   -- admin assigné

  category        dispute_category NOT NULL,
  reason          TEXT        NOT NULL,
  description     TEXT,

  status          dispute_status NOT NULL DEFAULT 'open',

  -- Conversation liée au litige
  conversation_id UUID        REFERENCES conversations(id),

  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID        REFERENCES profiles(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_order   ON disputes(order_id);
CREATE INDEX idx_disputes_status  ON disputes(status);
CREATE INDEX idx_disputes_opened  ON disputes(opened_by);
CREATE INDEX idx_disputes_assigned ON disputes(assigned_to) WHERE assigned_to IS NOT NULL;

-- ── Preuves soumises dans un litige ─────────────────────────────────
CREATE TABLE dispute_evidence (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id      UUID        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  submitted_by    UUID        NOT NULL REFERENCES profiles(id),
  description     TEXT,
  files           JSONB       NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Messages dans le litige (différents des DM normaux) ──────────────
CREATE TABLE dispute_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id      UUID        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES profiles(id),
  body            TEXT        NOT NULL,
  is_internal     BOOLEAN     NOT NULL DEFAULT FALSE,  -- note interne admin uniquement
  attachments     JSONB       NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dispute_msgs ON dispute_messages(dispute_id, created_at ASC);

-- ── Décisions de litige (inviolable, append-only) ────────────────────
CREATE TABLE dispute_decisions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id      UUID        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  decided_by      UUID        NOT NULL REFERENCES profiles(id),

  decision        dispute_decision NOT NULL,
  refund_percent  INT         CHECK (refund_percent BETWEEN 0 AND 100),
  refund_cents    BIGINT      CHECK (refund_cents >= 0),
  reason          TEXT        NOT NULL,
  internal_notes  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_decisions_dispute ON dispute_decisions(dispute_id);

-- Trigger: mise à jour statut order quand dispute résolue
CREATE OR REPLACE FUNCTION fn_dispute_resolved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    -- Récupère la dernière décision
    UPDATE orders
    SET status = CASE
      WHEN (SELECT decision FROM dispute_decisions WHERE dispute_id = NEW.id ORDER BY created_at DESC LIMIT 1) = 'refund_client' THEN 'refunded'
      WHEN (SELECT decision FROM dispute_decisions WHERE dispute_id = NEW.id ORDER BY created_at DESC LIMIT 1) = 'release_freelance' THEN 'completed'
      ELSE 'disputed'
    END
    WHERE id = NEW.order_id;

    -- Met à jour l'escrow
    UPDATE escrow_transactions
    SET status = CASE
      WHEN (SELECT decision FROM dispute_decisions WHERE dispute_id = NEW.id ORDER BY created_at DESC LIMIT 1) = 'refund_client' THEN 'refunded'
      WHEN (SELECT decision FROM dispute_decisions WHERE dispute_id = NEW.id ORDER BY created_at DESC LIMIT 1) = 'release_freelance' THEN 'completed'
      ELSE status
    END
    WHERE order_id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dispute_resolution
  AFTER UPDATE OF status ON disputes
  FOR EACH ROW EXECUTE FUNCTION fn_dispute_resolved();

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Lier la FK disputes → conversations (ajoutée après création des 2 tables)
ALTER TABLE conversations
  ADD CONSTRAINT fk_conv_dispute
  FOREIGN KEY (dispute_id) REFERENCES disputes(id);

-- ════════════════════════════════════════════
-- ADMINISTRATION
-- ════════════════════════════════════════════

-- Note: les rôles admin sont dans auth.users.app_metadata (géré par Supabase Auth)
-- Cette table stocke les permissions custom supplémentaires

CREATE TABLE admin_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  role        admin_role  NOT NULL,
  granted_by  UUID        REFERENCES profiles(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_admin_roles_profile ON admin_roles(profile_id);
CREATE INDEX idx_admin_roles_role    ON admin_roles(role) WHERE is_active = TRUE;

CREATE TABLE admin_permissions (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  role            admin_role NOT NULL,
  resource        TEXT    NOT NULL,   -- 'users','services','orders','escrow','kyc','disputes','finance'
  can_read        BOOLEAN NOT NULL DEFAULT FALSE,
  can_write       BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete      BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (role, resource)
);

-- Matrice des permissions par rôle
INSERT INTO admin_permissions (role, resource, can_read, can_write, can_delete, can_approve) VALUES
-- super_admin : tout
  ('super_admin','users',TRUE,TRUE,TRUE,TRUE),
  ('super_admin','services',TRUE,TRUE,TRUE,TRUE),
  ('super_admin','projects',TRUE,TRUE,TRUE,TRUE),
  ('super_admin','orders',TRUE,TRUE,FALSE,TRUE),
  ('super_admin','escrow',TRUE,TRUE,FALSE,TRUE),
  ('super_admin','kyc',TRUE,TRUE,FALSE,TRUE),
  ('super_admin','disputes',TRUE,TRUE,FALSE,TRUE),
  ('super_admin','finance',TRUE,TRUE,FALSE,TRUE),
  ('super_admin','posts',TRUE,TRUE,TRUE,TRUE),
-- admin : lecture totale + modération
  ('admin','users',TRUE,TRUE,FALSE,TRUE),
  ('admin','services',TRUE,TRUE,FALSE,TRUE),
  ('admin','projects',TRUE,TRUE,FALSE,TRUE),
  ('admin','orders',TRUE,FALSE,FALSE,FALSE),
  ('admin','escrow',TRUE,FALSE,FALSE,FALSE),
  ('admin','kyc',TRUE,TRUE,FALSE,TRUE),
  ('admin','disputes',TRUE,TRUE,FALSE,TRUE),
-- moderator : KYC + services + projets + posts
  ('moderator','services',TRUE,TRUE,FALSE,TRUE),
  ('moderator','projects',TRUE,TRUE,FALSE,TRUE),
  ('moderator','kyc',TRUE,TRUE,FALSE,TRUE),
  ('moderator','posts',TRUE,TRUE,FALSE,TRUE),
  ('moderator','users',TRUE,FALSE,FALSE,FALSE),
-- support : conversations + litiges
  ('support','disputes',TRUE,TRUE,FALSE,TRUE),
  ('support','orders',TRUE,FALSE,FALSE,FALSE),
  ('support','users',TRUE,FALSE,FALSE,FALSE),
-- finance : escrow + paiements uniquement
  ('finance','escrow',TRUE,TRUE,FALSE,TRUE),
  ('finance','finance',TRUE,TRUE,FALSE,TRUE),
  ('finance','orders',TRUE,FALSE,FALSE,FALSE);

-- ── Logs des actions admin (inviolable) ──────────────────────────────
CREATE TABLE admin_action_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID        NOT NULL REFERENCES profiles(id),
  admin_role      admin_role  NOT NULL,

  action          TEXT        NOT NULL,   -- 'approve_service','reject_kyc','release_escrow', etc.
  resource_type   TEXT        NOT NULL,
  resource_id     UUID,

  -- Avant/après pour audit complet
  before_state    JSONB,
  after_state     JSONB,

  ip_address      INET,
  user_agent      TEXT,
  note            TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admin_logs_admin    ON admin_action_logs(admin_id, created_at DESC);
CREATE INDEX idx_admin_logs_resource ON admin_action_logs(resource_type, resource_id);

-- ── Queue de modération ───────────────────────────────────────────────
CREATE TABLE moderation_queue (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type     moderation_target_type NOT NULL,
  target_id       UUID        NOT NULL,

  status          moderation_status NOT NULL DEFAULT 'pending',
  priority        INT         NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 10),

  -- Assignation
  assigned_to     UUID        REFERENCES profiles(id),
  assigned_at     TIMESTAMPTZ,

  -- Raison de mise en queue
  reason          TEXT,
  flagged_by      UUID        REFERENCES profiles(id),

  -- Décision
  decided_by      UUID        REFERENCES profiles(id),
  decision_note   TEXT,
  decided_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_modqueue_status ON moderation_queue(status, priority DESC);
CREATE INDEX idx_modqueue_target ON moderation_queue(target_type, target_id);
CREATE INDEX idx_modqueue_assigned ON moderation_queue(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE TRIGGER trg_modqueue_updated_at
  BEFORE UPDATE ON moderation_queue
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ════════════════════════════════════════════
-- NOTIFICATIONS
-- ════════════════════════════════════════════

CREATE TABLE notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  type            notification_type NOT NULL,
  title           TEXT        NOT NULL,
  body            TEXT,

  -- Données contextuelles
  data            JSONB       NOT NULL DEFAULT '{}',

  -- État
  is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,

  -- Lien de navigation
  action_url      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user      ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notif_unread    ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;

-- ════════════════════════════════════════════
-- PARAMÈTRES PLATEFORME & AUDIT GLOBAL
-- ════════════════════════════════════════════

CREATE TABLE platform_settings (
  key         TEXT    PRIMARY KEY,
  value       JSONB   NOT NULL,
  description TEXT,
  updated_by  UUID    REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('commission_rates', '{"free":0.15,"pro":0.10,"business":0.07}', 'Taux de commission par plan'),
  ('kyc_required_freelance', 'true', 'KYC obligatoire pour publier un service'),
  ('auto_validate_days', '7', 'Jours avant validation automatique de livraison'),
  ('max_revisions', '5', 'Nombre max de révisions autorisées'),
  ('min_service_price_xof', '5000', 'Prix minimum service en XOF'),
  ('maintenance_mode', 'false', 'Mode maintenance activé');

CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id),
  action      TEXT        NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  changes     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user   ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- ── Fonction centralisée : log action admin ──────────────────────────
CREATE OR REPLACE FUNCTION fn_log_admin_action(
  p_admin_id      UUID,
  p_admin_role    admin_role,
  p_action        TEXT,
  p_resource_type TEXT,
  p_resource_id   UUID,
  p_before        JSONB DEFAULT NULL,
  p_after         JSONB DEFAULT NULL,
  p_note          TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO admin_action_logs(admin_id, admin_role, action, resource_type, resource_id, before_state, after_state, note)
  VALUES (p_admin_id, p_admin_role, p_action, p_resource_type, p_resource_id, p_before, p_after, p_note)
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$;
