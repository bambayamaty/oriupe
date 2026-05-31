-- ═══════════════════════════════════════════════════════════════════
-- 016_correctifs_settings.sql — Correctifs post-audit + double validation
-- ═══════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 1. TAUX DE COMMISSION : aligner sur les niveaux freelance réels
--    (free:15/pro:10/business:7 → standard:12/top_oriupe:8/elite:5)
-- ────────────────────────────────────────────────────────────────────
UPDATE platform_settings
SET value = '{"standard": 0.12, "top_oriupe": 0.08, "elite": 0.05}'
WHERE key = 'commission_rates';

-- ────────────────────────────────────────────────────────────────────
-- 2. SETTINGS MANQUANTS
-- ────────────────────────────────────────────────────────────────────
INSERT INTO platform_settings (key, value, description) VALUES
  ('sla_kyc_heures',                   '48',   'Délai max traitement KYC en heures'),
  ('jours_validation_auto_escrow',     '7',    'Jours avant validation auto si client inactif'),
  ('montant_minimum_commande_fcfa',    '5000', 'Commande minimum en FCFA'),
  ('delai_litige_heures',              '72',   'Délai pour ouvrir un litige après livraison (h)'),
  ('seuil_top_oriupe_commandes',       '10',   'Commandes requises pour niveau Top Oriupe'),
  ('seuil_top_oriupe_note',            '4.5',  'Note minimale pour niveau Top Oriupe'),
  ('seuil_elite_commandes',            '50',   'Commandes requises pour niveau Elite'),
  ('seuil_elite_note',                 '4.8',  'Note minimale pour niveau Elite'),
  ('penalite_retard_pct_par_jour',     '0.05', 'Pénalité de retard par jour (5 %)'),
  ('penalite_retard_plafond_pct',      '0.30', 'Plafond des pénalités de retard (30 %)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ────────────────────────────────────────────────────────────────────
-- 3. COLONNES DE DOUBLE-VALIDATION SUR ORDERS
--    (pour le trigger qui déclenche la libération escrow)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS client_validated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS freelance_validated_at TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────────────
-- 4. TRIGGER DOUBLE-VALIDATION ESCROW
--    Quand client ET freelance ont tous les deux validé → passe en
--    statut 'validated'. La Edge Function liberation-paiement-escrow
--    est notifiée via pg_net (http call) ou écoute le changement statut.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_check_double_validation_escrow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.client_validated_at IS NOT NULL
     AND NEW.freelance_validated_at IS NOT NULL
     AND OLD.status = 'delivered'
     AND NEW.status = 'delivered' THEN

    NEW.status := 'validated';
    NEW.updated_at := NOW();

    INSERT INTO order_status_events (order_id, from_status, to_status, triggered_by, note)
    VALUES (NEW.id, 'delivered', 'validated', auth.uid(), 'Double validation client + freelance');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_double_validation_escrow
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_check_double_validation_escrow();

-- ────────────────────────────────────────────────────────────────────
-- 5. ACTIVER LE TRIGGER SIGNUP (commenté dans 011_rpc_functions.sql)
-- ────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_auth_user_created ON auth.users;

CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_create_profile_after_signup();

-- ────────────────────────────────────────────────────────────────────
-- 6. ACTIVER REALTIME SUR LES TABLES CRITIQUES
-- ────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE escrow_transactions;
