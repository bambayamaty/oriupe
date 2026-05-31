-- ═══════════════════════════════════════════════════════════════════
-- 020_storage_contracts.sql — Bucket Supabase Storage pour les contrats PDF
-- Dépend de : 006_orders_escrow.sql, 012_rls_policies.sql, 013_storage_realtime.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── Bucket contracts (privé) ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts', 'contracts', FALSE,
  5242880,  -- 5 Mo max
  ARRAY['text/html', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── Politiques RLS storage.objects ───────────────────────────────

-- Lecture : client ou freelance de la commande, et admins
CREATE POLICY "contracts_select_party"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contracts'
    AND (
      -- L'order_id est extrait du path : contracts/{order_id}/...
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = (
          NULLIF(split_part(name, '/', 2), '')::UUID
        )
        AND (
          o.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM freelance_profiles fp
            WHERE fp.id = o.freelance_id AND fp.profile_id = auth.uid()
          )
        )
      )
      OR EXISTS (SELECT 1 FROM admin_roles WHERE profile_id = auth.uid())
    )
  );

-- Écriture : service role uniquement (Edge Function generation-contrat-pdf)
-- Les Edge Functions utilisent SUPABASE_SERVICE_ROLE_KEY → bypass RLS automatique.
-- Pas de policy INSERT/UPDATE/DELETE publique intentionnellement.
