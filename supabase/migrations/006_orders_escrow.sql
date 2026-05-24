-- ═══════════════════════════════════════════════════════════════════
-- 006_orders_escrow.sql — Commandes, Escrow et Paiements
-- Dépend de : 002_profiles.sql, 004_services.sql, 005_projects.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── orders : table centrale du flux de commande ──────────────────────
CREATE TABLE orders (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties prenantes
  client_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  freelance_id        UUID        NOT NULL REFERENCES freelance_profiles(id) ON DELETE RESTRICT,

  -- Source
  source              order_source NOT NULL DEFAULT 'service',
  service_id          UUID        REFERENCES services(id),
  service_package_id  UUID        REFERENCES service_packages(id),
  project_id          UUID        REFERENCES projects(id),
  proposal_id         UUID        REFERENCES project_proposals(id),

  -- Référence visible
  ref                 TEXT        NOT NULL UNIQUE,   -- ex: ORD-2026-001234

  -- Contenu
  title               TEXT        NOT NULL,
  description         TEXT,
  requirements        TEXT,

  -- Montants (en centimes)
  amount_total_cents  BIGINT      NOT NULL CHECK (amount_total_cents > 0),
  commission_rate     NUMERIC(5,4) NOT NULL DEFAULT 0.15 CHECK (commission_rate BETWEEN 0 AND 1),
  commission_cents    BIGINT      GENERATED ALWAYS AS (ROUND(amount_total_cents * commission_rate)) STORED,
  amount_net_cents    BIGINT      GENERATED ALWAYS AS (amount_total_cents - ROUND(amount_total_cents * commission_rate)) STORED,
  amount_refunded_cents BIGINT    NOT NULL DEFAULT 0 CHECK (amount_refunded_cents >= 0),

  -- Devise
  currency            currency_code NOT NULL DEFAULT 'XOF',

  -- Délai & révisions
  delivery_days       INT         NOT NULL CHECK (delivery_days > 0),
  revisions_included  INT         NOT NULL DEFAULT 1,
  revisions_used      INT         NOT NULL DEFAULT 0,

  -- Statut
  status              order_status NOT NULL DEFAULT 'pending_payment',

  -- Code escrow (généré à la création)
  escrow_code         TEXT        NOT NULL UNIQUE,

  -- Dates clés
  deadline            TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  auto_validate_at    TIMESTAMPTZ,  -- validation automatique à J+7 si client inactif

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte: le montant remboursé ne dépasse pas le total
  CONSTRAINT check_refund_limit CHECK (amount_refunded_cents <= amount_total_cents),
  -- Contrainte: les sources sont cohérentes
  CONSTRAINT check_order_source CHECK (
    (source = 'service'           AND service_id IS NOT NULL) OR
    (source = 'project_proposal'  AND project_id IS NOT NULL AND proposal_id IS NOT NULL) OR
    (source = 'direct')
  )
);

CREATE INDEX idx_orders_client    ON orders(client_id);
CREATE INDEX idx_orders_freelance ON orders(freelance_id);
CREATE INDEX idx_orders_status    ON orders(status);
CREATE INDEX idx_orders_ref       ON orders(ref);
CREATE INDEX idx_orders_service   ON orders(service_id);
CREATE INDEX idx_orders_project   ON orders(project_id);
CREATE INDEX idx_orders_created   ON orders(created_at DESC);

-- ── Journal des changements de statut (inviolable, append-only) ──────
CREATE TABLE order_status_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status   order_status NOT NULL,
  triggered_by UUID       REFERENCES profiles(id),  -- NULL = système
  note        TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Pas d'UPDATE ni DELETE autorisé sur cette table (RLS + trigger)
CREATE INDEX idx_ose_order ON order_status_events(order_id, created_at DESC);

-- ── Livraisons ───────────────────────────────────────────────────────
CREATE TABLE order_deliveries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  submitted_by    UUID        NOT NULL REFERENCES profiles(id),
  message         TEXT,
  files           JSONB       NOT NULL DEFAULT '[]',   -- [{url, name, size, mime}]
  delivery_number INT         NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_deliveries_order ON order_deliveries(order_id);

-- ── Demandes de révision ─────────────────────────────────────────────
CREATE TABLE order_revisions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  requested_by    UUID        NOT NULL REFERENCES profiles(id),
  reason          TEXT        NOT NULL,
  revision_number INT         NOT NULL DEFAULT 1,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_revisions_order ON order_revisions(order_id);

-- ── escrow_transactions : état escrow d'une commande ────────────────
CREATE TABLE escrow_transactions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID        NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,

  status              escrow_status NOT NULL DEFAULT 'awaiting_payment',

  -- Montants (en centimes)
  amount_total_cents  BIGINT      NOT NULL CHECK (amount_total_cents > 0),
  amount_secured_cents BIGINT     NOT NULL DEFAULT 0,
  amount_released_cents BIGINT    NOT NULL DEFAULT 0,
  amount_refunded_cents BIGINT    NOT NULL DEFAULT 0,

  -- Paiement
  payment_operator    payment_operator,
  payment_provider    payment_provider,
  payment_ref         TEXT,           -- référence externe opérateur
  payment_metadata    JSONB,

  -- Libération
  released_at         TIMESTAMPTZ,
  released_by         UUID        REFERENCES profiles(id),

  -- Contrainte: pas de double libération complète
  CONSTRAINT check_no_double_release CHECK (
    amount_released_cents <= amount_total_cents
  ),
  -- Contrainte: pas de remboursement après libération complète
  CONSTRAINT check_no_refund_after_release CHECK (
    NOT (amount_released_cents = amount_total_cents AND amount_refunded_cents > 0)
  ),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escrow_order  ON escrow_transactions(order_id);
CREATE INDEX idx_escrow_status ON escrow_transactions(status);

-- ── Journal escrow (inviolable, audit complet) ───────────────────────
CREATE TABLE escrow_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id       UUID        NOT NULL REFERENCES escrow_transactions(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,  -- 'payment_received','funds_released','refund_issued', etc.
  amount_cents    BIGINT,
  triggered_by    UUID        REFERENCES profiles(id),
  note            TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_escrow_events ON escrow_events(escrow_id, created_at DESC);

-- ── payment_transactions : détail chaque tentative de paiement ───────
CREATE TABLE payment_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL REFERENCES orders(id),
  escrow_id       UUID        REFERENCES escrow_transactions(id),
  initiated_by    UUID        NOT NULL REFERENCES profiles(id),

  amount_cents    BIGINT      NOT NULL CHECK (amount_cents > 0),
  currency        currency_code NOT NULL DEFAULT 'XOF',

  operator        payment_operator NOT NULL,
  provider        payment_provider NOT NULL,
  status          payment_status NOT NULL DEFAULT 'pending',

  -- Référence externe (CinetPay, FedaPay…)
  external_ref    TEXT,
  external_status TEXT,
  webhook_payload JSONB,

  -- Durée de traitement
  initiated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order   ON payment_transactions(order_id);
CREATE INDEX idx_payments_status  ON payment_transactions(status);
CREATE INDEX idx_payments_ref     ON payment_transactions(external_ref);

-- ── Fonction : génération code escrow ────────────────────────────────
CREATE OR REPLACE FUNCTION fn_generate_escrow_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  prefix TEXT;
  year TEXT;
BEGIN
  year   := to_char(NOW(), 'YY');
  prefix := 'ESC-' || year || '-';

  LOOP
    code := prefix || upper(substring(md5(random()::text) from 1 for 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE escrow_code = code);
  END LOOP;

  RETURN code;
END;
$$;

-- ── Triggers orders ──────────────────────────────────────────────────
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_escrow_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Trigger: synchronise escrow_status → order.status ────────────────
CREATE OR REPLACE FUNCTION fn_sync_escrow_to_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'funds_secured' AND OLD.status = 'awaiting_payment' THEN
    UPDATE orders SET status = 'paid', paid_at = NOW()
    WHERE id = NEW.order_id AND status = 'pending_payment';
  ELSIF NEW.status = 'completed' THEN
    UPDATE orders SET status = 'completed', completed_at = NOW()
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'refunded' THEN
    UPDATE orders SET status = 'refunded'
    WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_escrow_sync_order
  AFTER UPDATE ON escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION fn_sync_escrow_to_order_status();

-- ── Trigger: journal automatique des changements de statut commande ──
CREATE OR REPLACE FUNCTION fn_log_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_events(order_id, from_status, to_status, triggered_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_status_log
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_log_order_status_change();
