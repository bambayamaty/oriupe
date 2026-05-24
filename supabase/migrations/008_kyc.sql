-- ═══════════════════════════════════════════════════════════════════
-- 008_kyc.sql — Système KYC & Vérification d'identité
-- Dépend de : 002_profiles.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── kyc_cases : un dossier KYC par profil ───────────────────────────
CREATE TABLE kyc_cases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  status          kyc_status  NOT NULL DEFAULT 'not_submitted',
  case_ref        TEXT        UNIQUE,   -- référence interne KYC-2026-CI-XXXXX

  -- Données soumises
  document_type   TEXT        CHECK (document_type IN ('cni','passport','residence_permit')),
  full_name       TEXT,
  date_of_birth   DATE,
  nationality     CHAR(2),    -- code pays ISO

  -- Mobile Money (numéro vérifié)
  mobile_money_operator payment_operator,
  mobile_money_phone    TEXT,
  mobile_verified BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Résultat & notation
  verified_by     UUID        REFERENCES profiles(id),
  verified_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  risk_score      INT         CHECK (risk_score BETWEEN 0 AND 100),  -- score interne
  notes           TEXT,       -- notes admin internes

  submitted_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,   -- KYC valable 2 ans
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_profile ON kyc_cases(profile_id);
CREATE INDEX idx_kyc_status  ON kyc_cases(status);

-- ── kyc_documents : fichiers soumis ─────────────────────────────────
CREATE TABLE kyc_documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id     UUID        NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,

  doc_type        TEXT        NOT NULL CHECK (doc_type IN (
    'id_front','id_back','selfie','proof_of_residence',
    'business_registration','bank_statement','other'
  )),
  name            TEXT        NOT NULL,
  storage_path    TEXT        NOT NULL,   -- path dans bucket 'kyc-documents'
  url             TEXT,                    -- URL signée, générée dynamiquement
  size_bytes      BIGINT,
  mime_type       TEXT,

  -- Validation par document
  is_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
  rejection_note  TEXT,

  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kycdocs_case ON kyc_documents(kyc_case_id);

-- ── kyc_reviews : historique complet des décisions ──────────────────
-- Inviolable : pas d'UPDATE ni DELETE
CREATE TABLE kyc_reviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id     UUID        NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
  reviewed_by     UUID        NOT NULL REFERENCES profiles(id),

  decision        TEXT        NOT NULL CHECK (decision IN ('approved','rejected','needs_more_info','escalated')),
  reason          TEXT,           -- obligatoire si rejected
  notes           TEXT,

  -- Données vérifiées
  verified_name   TEXT,
  verified_dob    DATE,
  verified_nationality CHAR(2),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kycrev_case ON kyc_reviews(kyc_case_id, created_at DESC);

-- Contrainte: raison obligatoire en cas de rejet
ALTER TABLE kyc_reviews ADD CONSTRAINT check_rejection_reason
  CHECK (decision != 'rejected' OR (reason IS NOT NULL AND length(reason) > 10));

-- ── Trigger: synchronise kyc_cases.status → profiles.kyc_status ─────
CREATE OR REPLACE FUNCTION fn_sync_kyc_to_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET
    kyc_status = NEW.status,
    is_kyc_verified = (NEW.status = 'approved'),
    kyc_verified_at = CASE WHEN NEW.status = 'approved' THEN NOW() ELSE kyc_verified_at END,
    account_status = CASE
      WHEN NEW.status = 'approved' THEN 'active'
      WHEN NEW.status = 'submitted' OR NEW.status = 'under_review' THEN 'kyc_submitted'
      ELSE account_status
    END
  WHERE id = NEW.profile_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kyc_sync_profile
  AFTER UPDATE OF status ON kyc_cases
  FOR EACH ROW EXECUTE FUNCTION fn_sync_kyc_to_profile();

CREATE TRIGGER trg_kyc_updated_at
  BEFORE UPDATE ON kyc_cases
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
