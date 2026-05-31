-- ═══════════════════════════════════════════════════════════════════
-- 015_contrats_numeriques.sql — Contrats numériques signés
-- Dépend de : 002_profiles.sql, 006_orders_escrow.sql
-- Requis par : Edge Function generation-contrat-pdf
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE contrats_numeriques (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  UUID        NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,

  -- Parties
  client_id                 UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  freelance_id              UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  -- Référence visible (ex: CTR-2026-00892)
  reference                 TEXT        NOT NULL UNIQUE,

  -- Contenu
  titre                     TEXT        NOT NULL,
  description_mission       TEXT        NOT NULL,
  livrables                 JSONB       NOT NULL DEFAULT '[]',   -- [{label}]
  conditions_particulieres  TEXT,

  -- Montants en centimes (dupliqués depuis orders pour immuabilité du contrat)
  montant_total_cents       BIGINT      NOT NULL CHECK (montant_total_cents > 0),
  taux_commission           NUMERIC(5,4) NOT NULL,
  montant_commission_cents  BIGINT      NOT NULL CHECK (montant_commission_cents >= 0),
  montant_net_cents         BIGINT      NOT NULL CHECK (montant_net_cents > 0),

  -- Délais
  date_debut                DATE        NOT NULL,
  date_livraison_prevue     DATE        NOT NULL,
  duree_jours               INT         NOT NULL CHECK (duree_jours > 0),
  nb_revisions              INT         NOT NULL DEFAULT 0,

  -- Statut
  statut                    TEXT        NOT NULL DEFAULT 'draft'
    CHECK (statut IN ('draft', 'sent', 'signed_client', 'signed_freelance', 'fully_signed', 'void')),

  -- Signature client
  signature_client_le       TIMESTAMPTZ,
  signature_client_ip       INET,
  signature_client_agent    TEXT,

  -- Signature freelance
  signature_freelance_le    TIMESTAMPTZ,
  signature_freelance_ip    INET,
  signature_freelance_agent TEXT,

  -- PDF généré
  pdf_url                   TEXT,
  pdf_generated_le          TIMESTAMPTZ,
  pdf_checksum              TEXT,   -- SHA-256 pour vérification d'intégrité

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_contrat_dates CHECK (date_livraison_prevue >= date_debut)
);

CREATE INDEX idx_contrats_order_id    ON contrats_numeriques(order_id);
CREATE INDEX idx_contrats_client_id   ON contrats_numeriques(client_id);
CREATE INDEX idx_contrats_freelance_id ON contrats_numeriques(freelance_id);
CREATE INDEX idx_contrats_statut      ON contrats_numeriques(statut);
CREATE INDEX idx_contrats_reference   ON contrats_numeriques(reference);

-- ── Trigger updated_at ───────────────────────────────────────────────
CREATE TRIGGER trg_contrats_updated_at
  BEFORE UPDATE ON contrats_numeriques
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Génération de référence ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_generate_contrat_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_ref TEXT;
BEGIN
  IF NEW.reference IS NULL THEN
    LOOP
      v_ref := 'CTR-' || to_char(NOW(), 'YYYY') || '-' ||
                LPAD(FLOOR(RANDOM() * 99999 + 1)::TEXT, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM contrats_numeriques WHERE reference = v_ref);
    END LOOP;
    NEW.reference := v_ref;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contrats_reference
  BEFORE INSERT ON contrats_numeriques
  FOR EACH ROW EXECUTE FUNCTION fn_generate_contrat_reference();

-- ── Mise à jour statut quand les deux ont signé ──────────────────────
CREATE OR REPLACE FUNCTION fn_check_double_signature_contrat()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.signature_client_le IS NOT NULL AND NEW.signature_freelance_le IS NOT NULL
     AND NEW.statut != 'fully_signed' THEN
    NEW.statut := 'fully_signed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contrats_double_signature
  BEFORE UPDATE ON contrats_numeriques
  FOR EACH ROW EXECUTE FUNCTION fn_check_double_signature_contrat();

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE contrats_numeriques ENABLE ROW LEVEL SECURITY;

-- Les parties voient leurs propres contrats
CREATE POLICY "contrats_select_parties" ON contrats_numeriques
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = freelance_id);

-- Admins voient tout
CREATE POLICY "contrats_select_admin" ON contrats_numeriques
  FOR SELECT USING (fn_is_admin());

-- Seules les RPCs SECURITY DEFINER peuvent insérer / modifier
CREATE POLICY "contrats_no_direct_write" ON contrats_numeriques
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "contrats_no_direct_update" ON contrats_numeriques
  FOR UPDATE USING (FALSE);
