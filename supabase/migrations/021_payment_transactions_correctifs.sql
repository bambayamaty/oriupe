-- ═══════════════════════════════════════════════════════════════════
-- 021_payment_transactions_correctifs.sql
-- Colonnes manquantes sur payment_transactions + valeur enum manquante
-- Dépend de : 006_orders_escrow.sql, 001_enums.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Ajouter 'completed' au type payment_status ─────────────────
--    (les Edge Functions cinetpay-webhook et confirmation-virement
--     écrivent status = 'completed' ; l'enum n'avait que 'succeeded')
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'completed';

-- ── 2. Colonnes manquantes sur payment_transactions ───────────────
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS processed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;
