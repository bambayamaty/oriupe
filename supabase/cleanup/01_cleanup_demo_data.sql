-- ═══════════════════════════════════════════════════════════════════════
-- 01_cleanup_demo_data.sql — Suppression des données seed/demo
--
-- INSTRUCTIONS :
--   1. Exécuter 00_dry_run.sql d'abord et vérifier les comptes réels
--   2. S'assurer que bambayamaty@gmail.com est bien dans "profils_reels"
--   3. Exécuter ce script dans Supabase Dashboard > SQL Editor
--   4. Vérifier le rapport final affiché par le script
--   5. Si doute → ROLLBACK
--
-- CE SCRIPT NE SUPPRIME PAS :
--   - les tables, enums, fonctions, triggers, politiques RLS
--   - les buckets Storage
--   - la configuration auth réelle
--   - les catégories (créées par 003_referentials.sql)
--   - les pays, devises, méthodes de paiement
--   - les profils réels (tout UUID != 10/20/30 000000-...)
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- Sauvegarder les comptes réels avant toute opération (vérification de sécurité)
DO $$
DECLARE
  real_count INT;
  demo_count INT;
BEGIN
  SELECT count(*) INTO real_count FROM profiles
  WHERE id::text NOT LIKE '10000000-0000-0000-0000-%'
    AND id::text NOT LIKE '20000000-0000-0000-0000-%'
    AND id::text NOT LIKE '30000000-0000-0000-0000-%';

  SELECT count(*) INTO demo_count FROM profiles
  WHERE id::text LIKE '10000000-0000-0000-0000-%'
     OR id::text LIKE '20000000-0000-0000-0000-%'
     OR id::text LIKE '30000000-0000-0000-0000-%';

  RAISE NOTICE '=== PRÉ-SUPPRESSION ===';
  RAISE NOTICE 'Profils réels conservés : %', real_count;
  RAISE NOTICE 'Profils demo à supprimer : %', demo_count;

  IF real_count = 0 THEN
    RAISE EXCEPTION 'ABORT : aucun profil réel trouvé — vérifier la base avant de continuer';
  END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 : Identifier les profils demo
-- ──────────────────────────────────────────────────────────────────────

-- IDs clients demo
CREATE TEMP TABLE _demo_client_ids AS
SELECT id FROM profiles
WHERE id::text LIKE '10000000-0000-0000-0000-%';

-- IDs freelances demo
CREATE TEMP TABLE _demo_freelance_ids AS
SELECT id FROM profiles
WHERE id::text LIKE '20000000-0000-0000-0000-%';

-- IDs admins demo
CREATE TEMP TABLE _demo_admin_ids AS
SELECT id FROM profiles
WHERE id::text LIKE '30000000-0000-0000-0000-%';

-- Tous les IDs demo confondus
CREATE TEMP TABLE _demo_all_ids AS
SELECT id FROM _demo_client_ids
UNION ALL
SELECT id FROM _demo_freelance_ids
UNION ALL
SELECT id FROM _demo_admin_ids;

-- IDs services demo (liés aux freelances demo)
CREATE TEMP TABLE _demo_service_ids AS
SELECT id FROM services
WHERE freelance_id IN (SELECT id FROM _demo_freelance_ids);

-- IDs projets demo (UUIDs fixes + liés aux clients demo)
CREATE TEMP TABLE _demo_project_ids AS
SELECT id FROM projects
WHERE id::text LIKE '50000000-0000-0000-0000-%'
   OR client_id IN (SELECT id FROM _demo_client_ids);

-- IDs commandes demo (liées aux clients ou freelances demo)
CREATE TEMP TABLE _demo_order_ids AS
SELECT id FROM orders
WHERE client_id IN (SELECT id FROM _demo_client_ids)
   OR freelance_id IN (SELECT id FROM _demo_freelance_ids);

-- IDs conversations demo
CREATE TEMP TABLE _demo_conv_ids AS
SELECT id FROM conversations
WHERE created_by IN (SELECT id FROM _demo_all_ids)
   OR order_id IN (SELECT id FROM _demo_order_ids);

-- ──────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 : Supprimer dans l'ordre enfant → parent
-- ──────────────────────────────────────────────────────────────────────

-- ── 2a. Litiges ──────────────────────────────────────────────────────
DELETE FROM dispute_decisions
WHERE dispute_id IN (
  SELECT id FROM disputes
  WHERE client_id IN (SELECT id FROM _demo_client_ids)
     OR freelance_id IN (SELECT id FROM _demo_freelance_ids)
     OR order_id IN (SELECT id FROM _demo_order_ids)
);

DELETE FROM dispute_evidence
WHERE dispute_id IN (
  SELECT id FROM disputes
  WHERE client_id IN (SELECT id FROM _demo_client_ids)
     OR freelance_id IN (SELECT id FROM _demo_freelance_ids)
     OR order_id IN (SELECT id FROM _demo_order_ids)
);

DELETE FROM dispute_messages
WHERE dispute_id IN (
  SELECT id FROM disputes
  WHERE client_id IN (SELECT id FROM _demo_client_ids)
     OR freelance_id IN (SELECT id FROM _demo_freelance_ids)
     OR order_id IN (SELECT id FROM _demo_order_ids)
);

DELETE FROM disputes
WHERE client_id IN (SELECT id FROM _demo_client_ids)
   OR freelance_id IN (SELECT id FROM _demo_freelance_ids)
   OR order_id IN (SELECT id FROM _demo_order_ids);

-- ── 2b. Avis ─────────────────────────────────────────────────────────
DELETE FROM review_replies
WHERE review_id IN (
  SELECT id FROM reviews
  WHERE freelance_id IN (SELECT id FROM _demo_freelance_ids)
     OR author_id IN (SELECT id FROM _demo_client_ids)
);

DELETE FROM reviews
WHERE freelance_id IN (SELECT id FROM _demo_freelance_ids)
   OR author_id IN (SELECT id FROM _demo_client_ids);

-- ── 2c. Messagerie ───────────────────────────────────────────────────
DELETE FROM message_reads
WHERE message_id IN (
  SELECT id FROM messages WHERE conversation_id IN (SELECT id FROM _demo_conv_ids)
);

DELETE FROM message_attachments
WHERE message_id IN (
  SELECT id FROM messages WHERE conversation_id IN (SELECT id FROM _demo_conv_ids)
);

DELETE FROM messages
WHERE conversation_id IN (SELECT id FROM _demo_conv_ids)
   OR sender_id IN (SELECT id FROM _demo_all_ids);

DELETE FROM conversation_participants
WHERE conversation_id IN (SELECT id FROM _demo_conv_ids)
   OR user_id IN (SELECT id FROM _demo_all_ids);

DELETE FROM conversations
WHERE id IN (SELECT id FROM _demo_conv_ids);

-- ── 2d. Commandes & Escrow ───────────────────────────────────────────
DELETE FROM order_revisions
WHERE order_id IN (SELECT id FROM _demo_order_ids);

DELETE FROM order_deliveries
WHERE order_id IN (SELECT id FROM _demo_order_ids);

DELETE FROM order_status_events
WHERE order_id IN (SELECT id FROM _demo_order_ids);

DELETE FROM escrow_events
WHERE order_id IN (SELECT id FROM _demo_order_ids);

DELETE FROM payment_transactions
WHERE order_id IN (SELECT id FROM _demo_order_ids);

DELETE FROM escrow_transactions
WHERE order_id IN (SELECT id FROM _demo_order_ids);

DELETE FROM orders
WHERE id IN (SELECT id FROM _demo_order_ids);

-- ── 2e. Propositions & Projets ───────────────────────────────────────
DELETE FROM project_proposals
WHERE project_id IN (SELECT id FROM _demo_project_ids)
   OR freelance_id IN (SELECT id FROM _demo_freelance_ids);

DELETE FROM project_invitations
WHERE project_id IN (SELECT id FROM _demo_project_ids)
   OR freelance_id IN (SELECT id FROM _demo_freelance_ids);

DELETE FROM project_files
WHERE project_id IN (SELECT id FROM _demo_project_ids);

DELETE FROM project_skills
WHERE project_id IN (SELECT id FROM _demo_project_ids);

DELETE FROM projects
WHERE id IN (SELECT id FROM _demo_project_ids);

-- ── 2f. Services ─────────────────────────────────────────────────────
DELETE FROM service_tags
WHERE service_id IN (SELECT id FROM _demo_service_ids);

DELETE FROM service_extras
WHERE service_id IN (SELECT id FROM _demo_service_ids);

DELETE FROM service_faqs
WHERE service_id IN (SELECT id FROM _demo_service_ids);

DELETE FROM service_media
WHERE service_id IN (SELECT id FROM _demo_service_ids);

DELETE FROM service_package_features
WHERE package_id IN (
  SELECT id FROM service_packages
  WHERE service_id IN (SELECT id FROM _demo_service_ids)
);

DELETE FROM service_packages
WHERE service_id IN (SELECT id FROM _demo_service_ids);

DELETE FROM services
WHERE id IN (SELECT id FROM _demo_service_ids);

-- ── 2g. Profil freelance (sous-profil) ───────────────────────────────
DELETE FROM freelance_certifications
WHERE profile_id IN (SELECT id FROM _demo_freelance_ids);

DELETE FROM freelance_experiences
WHERE profile_id IN (SELECT id FROM _demo_freelance_ids);

DELETE FROM freelance_portfolio_items
WHERE profile_id IN (SELECT id FROM _demo_freelance_ids);

DELETE FROM freelance_languages
WHERE profile_id IN (SELECT id FROM _demo_freelance_ids);

DELETE FROM freelance_skills
WHERE profile_id IN (SELECT id FROM _demo_freelance_ids);

DELETE FROM freelance_profiles
WHERE profile_id IN (SELECT id FROM _demo_freelance_ids);

-- ── 2h. Profil client (sous-profil) ──────────────────────────────────
DELETE FROM client_profiles
WHERE profile_id IN (SELECT id FROM _demo_client_ids);

-- ── 2i. Contrats ─────────────────────────────────────────────────────
DELETE FROM contract_signatures
WHERE contract_id IN (
  SELECT id FROM contracts
  WHERE client_id IN (SELECT id FROM _demo_client_ids)
     OR freelance_id IN (SELECT id FROM _demo_freelance_ids)
);

DELETE FROM contracts
WHERE client_id IN (SELECT id FROM _demo_client_ids)
   OR freelance_id IN (SELECT id FROM _demo_freelance_ids);

-- ── 2j. Social & Notifications ───────────────────────────────────────
DELETE FROM saved_freelances
WHERE user_id IN (SELECT id FROM _demo_all_ids)
   OR freelance_id IN (SELECT id FROM _demo_freelance_ids);

DELETE FROM favorite_projects
WHERE user_id IN (SELECT id FROM _demo_all_ids)
   OR project_id IN (SELECT id FROM _demo_project_ids);

DELETE FROM favorite_services
WHERE user_id IN (SELECT id FROM _demo_all_ids)
   OR service_id IN (SELECT id FROM _demo_service_ids);

DELETE FROM notifications
WHERE user_id IN (SELECT id FROM _demo_all_ids);

-- ── 2k. KYC ──────────────────────────────────────────────────────────
DELETE FROM kyc_reviews
WHERE kyc_case_id IN (
  SELECT id FROM kyc_cases WHERE user_id IN (SELECT id FROM _demo_all_ids)
);

DELETE FROM kyc_documents
WHERE kyc_case_id IN (
  SELECT id FROM kyc_cases WHERE user_id IN (SELECT id FROM _demo_all_ids)
);

DELETE FROM kyc_cases
WHERE user_id IN (SELECT id FROM _demo_all_ids);

-- ── 2l. Admin ─────────────────────────────────────────────────────────
DELETE FROM admin_action_logs
WHERE admin_id IN (SELECT id FROM _demo_admin_ids);

DELETE FROM moderation_queue
WHERE moderator_id IN (SELECT id FROM _demo_admin_ids);

DELETE FROM admin_roles
WHERE profile_id IN (SELECT id FROM _demo_admin_ids)
   OR granted_by IN (SELECT id FROM _demo_admin_ids);

-- ── 2m. Fraude & anti-fraude ─────────────────────────────────────────
DELETE FROM fraude_tentatives
WHERE user_id IN (SELECT id FROM _demo_all_ids);

-- ── 2n. Profils (dernière étape) ─────────────────────────────────────
DELETE FROM profiles
WHERE id IN (SELECT id FROM _demo_all_ids);

-- ──────────────────────────────────────────────────────────────────────
-- OPTION A : Garder les référentiels seed (sous-catégories et skills)
-- OPTION B : Supprimer aussi les référentiels ajoutés par 014_seed.sql
-- ──────────────────────────────────────────────────────────────────────
-- Par défaut (OPTION A) : les lignes ci-dessous sont commentées.
-- Pour choisir OPTION B, dé-commenter les blocs suivants :

/*
-- OPTION B — Supprimer les sous-catégories ajoutées par le seed
DELETE FROM subcategories
WHERE slug IN (
  'react-next','mobile-flutter','wordpress','logo-branding',
  'ui-design','social-media','seo','copywriting','montage','comptabilite'
);

-- OPTION B — Supprimer les skills ajoutés par le seed
-- ATTENTION : vérifier qu'aucun vrai profil freelance ne les utilise
-- (normalement vide puisqu'on vient de supprimer tous les freelances demo)
DELETE FROM freelance_skills
WHERE skill_id IN (
  SELECT id FROM skills
  WHERE slug IN (
    'react','nextjs','flutter','figma','photoshop','wordpress',
    'facebook-ads','seo','copywriting','python'
  )
);

DELETE FROM skills
WHERE slug IN (
  'react','nextjs','flutter','figma','photoshop','wordpress',
  'facebook-ads','seo','copywriting','python'
);
*/

-- ──────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 : Rapport final
-- ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r_profiles   INT; r_services   INT; r_projects   INT;
  r_orders     INT; r_convs      INT; r_messages   INT;
  r_reviews    INT; r_roles      INT;
BEGIN
  SELECT count(*) INTO r_profiles FROM profiles;
  SELECT count(*) INTO r_services FROM services;
  SELECT count(*) INTO r_projects FROM projects;
  SELECT count(*) INTO r_orders   FROM orders;
  SELECT count(*) INTO r_convs    FROM conversations;
  SELECT count(*) INTO r_messages FROM messages;
  SELECT count(*) INTO r_reviews  FROM reviews;
  SELECT count(*) INTO r_roles    FROM admin_roles;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE '  RAPPORT POST-CLEANUP';
  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE '  profiles restants    : %', r_profiles;
  RAISE NOTICE '  services restants    : %', r_services;
  RAISE NOTICE '  projets restants     : %', r_projects;
  RAISE NOTICE '  commandes restantes  : %', r_orders;
  RAISE NOTICE '  conversations restes : %', r_convs;
  RAISE NOTICE '  messages restants    : %', r_messages;
  RAISE NOTICE '  avis restants        : %', r_reviews;
  RAISE NOTICE '  admin_roles restants : %', r_roles;
  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  Profils réels conservés :';
END;
$$;

-- Afficher les profils réels (vérification visuelle finale)
SELECT id, email, role, created_at
FROM profiles
ORDER BY created_at;

-- Nettoyage des tables temporaires
DROP TABLE IF EXISTS _demo_client_ids, _demo_freelance_ids, _demo_admin_ids,
  _demo_all_ids, _demo_service_ids, _demo_project_ids,
  _demo_order_ids, _demo_conv_ids;

-- ──────────────────────────────────────────────────────────────────────
-- Si tout est correct : COMMIT
-- Si doute : remplacer COMMIT par ROLLBACK
-- ──────────────────────────────────────────────────────────────────────
COMMIT;

-- En cas de doute : décommenter la ligne suivante et commenter COMMIT
-- ROLLBACK;
