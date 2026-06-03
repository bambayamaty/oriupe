-- ═══════════════════════════════════════════════════════════════════════
-- 00_dry_run.sql — Audit des données demo/seed à supprimer
-- LECTURE SEULE — aucune suppression
-- Exécuter dans Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. PROFILS DEMO ──────────────────────────────────────────────────
SELECT '=== PROFILS DEMO ===' AS section, NULL::int AS count, NULL AS detail;

SELECT role, count(*) AS nb, string_agg(email, ', ') AS emails
FROM profiles
WHERE
  id::text LIKE '10000000-0000-0000-0000-%'  -- clients seed
  OR id::text LIKE '20000000-0000-0000-0000-%'  -- freelances seed
  OR id::text LIKE '30000000-0000-0000-0000-%'  -- admins seed
GROUP BY role;

-- Compter le total
SELECT 'profiles_demo_total' AS key, count(*) AS count
FROM profiles
WHERE
  id::text LIKE '10000000-0000-0000-0000-%'
  OR id::text LIKE '20000000-0000-0000-0000-%'
  OR id::text LIKE '30000000-0000-0000-0000-%';

-- Vrai utilisateur confirmé à garder
SELECT 'profiles_real_users' AS key, count(*) AS count
FROM profiles
WHERE
  id::text NOT LIKE '10000000-0000-0000-0000-%'
  AND id::text NOT LIKE '20000000-0000-0000-0000-%'
  AND id::text NOT LIKE '30000000-0000-0000-0000-%';

SELECT email, role, created_at
FROM profiles
WHERE
  id::text NOT LIKE '10000000-0000-0000-0000-%'
  AND id::text NOT LIKE '20000000-0000-0000-0000-%'
  AND id::text NOT LIKE '30000000-0000-0000-0000-%'
ORDER BY created_at;

-- ── 2. SERVICES DEMO ─────────────────────────────────────────────────
SELECT '=== SERVICES DEMO ===' AS section, NULL::int AS count, NULL AS detail;

SELECT 'services_demo' AS key, count(*) AS count
FROM services
WHERE freelance_id::text LIKE '20000000-0000-0000-0000-%';

SELECT s.title, s.status, fp.slug AS freelance_slug
FROM services s
JOIN freelance_profiles fp ON fp.profile_id = s.freelance_id
WHERE s.freelance_id::text LIKE '20000000-0000-0000-0000-%'
ORDER BY fp.slug;

-- Packages liés
SELECT 'service_packages_demo' AS key, count(*) AS count
FROM service_packages sp
JOIN services s ON s.id = sp.service_id
WHERE s.freelance_id::text LIKE '20000000-0000-0000-0000-%';

-- ── 3. PROJETS DEMO ──────────────────────────────────────────────────
SELECT '=== PROJETS DEMO ===' AS section, NULL::int AS count, NULL AS detail;

SELECT 'projects_demo' AS key, count(*) AS count
FROM projects
WHERE
  id::text LIKE '50000000-0000-0000-0000-%'
  OR client_id::text LIKE '10000000-0000-0000-0000-%';

SELECT id, title, status FROM projects
WHERE
  id::text LIKE '50000000-0000-0000-0000-%'
  OR client_id::text LIKE '10000000-0000-0000-0000-%'
ORDER BY created_at;

-- ── 4. COMMANDES & ESCROW DEMO ───────────────────────────────────────
SELECT '=== COMMANDES & ESCROW DEMO ===' AS section, NULL::int AS count, NULL AS detail;

SELECT 'orders_demo' AS key, count(*) AS count
FROM orders
WHERE
  client_id::text LIKE '10000000-0000-0000-0000-%'
  OR freelance_id::text LIKE '20000000-0000-0000-0000-%';

SELECT 'escrow_transactions_demo' AS key, count(*) AS count
FROM escrow_transactions
WHERE order_id IN (
  SELECT id FROM orders
  WHERE
    client_id::text LIKE '10000000-0000-0000-0000-%'
    OR freelance_id::text LIKE '20000000-0000-0000-0000-%'
);

SELECT 'payment_transactions_demo' AS key, count(*) AS count
FROM payment_transactions
WHERE order_id IN (
  SELECT id FROM orders
  WHERE
    client_id::text LIKE '10000000-0000-0000-0000-%'
    OR freelance_id::text LIKE '20000000-0000-0000-0000-%'
);

-- ── 5. MESSAGERIE DEMO ───────────────────────────────────────────────
SELECT '=== MESSAGERIE DEMO ===' AS section, NULL::int AS count, NULL AS detail;

SELECT 'conversations_demo' AS key, count(*) AS count
FROM conversations
WHERE
  created_by::text LIKE '10000000-0000-0000-0000-%'
  OR created_by::text LIKE '20000000-0000-0000-0000-%'
  OR order_id IN (
    SELECT id FROM orders
    WHERE
      client_id::text LIKE '10000000-0000-0000-0000-%'
      OR freelance_id::text LIKE '20000000-0000-0000-0000-%'
  );

SELECT 'messages_demo' AS key, count(*) AS count
FROM messages
WHERE conversation_id IN (
  SELECT id FROM conversations
  WHERE
    created_by::text LIKE '10000000-0000-0000-0000-%'
    OR created_by::text LIKE '20000000-0000-0000-0000-%'
    OR order_id IN (
      SELECT id FROM orders
      WHERE
        client_id::text LIKE '10000000-0000-0000-0000-%'
        OR freelance_id::text LIKE '20000000-0000-0000-0000-%'
    )
);

-- ── 6. AVIS DEMO ─────────────────────────────────────────────────────
SELECT '=== AVIS DEMO ===' AS section, NULL::int AS count, NULL AS detail;

SELECT 'reviews_demo' AS key, count(*) AS count
FROM reviews
WHERE
  freelance_id::text LIKE '20000000-0000-0000-0000-%'
  OR author_id::text LIKE '10000000-0000-0000-0000-%';

-- ── 7. SOUS-CATÉGORIES & SKILLS SEED ─────────────────────────────────
SELECT '=== RÉFÉRENTIELS SEED ===' AS section, NULL::int AS count, NULL AS detail;

SELECT 'subcategories_seed' AS key, count(*) AS count
FROM subcategories
WHERE slug IN (
  'react-next','mobile-flutter','wordpress','logo-branding',
  'ui-design','social-media','seo','copywriting','montage','comptabilite'
);

SELECT slug, name_fr FROM subcategories
WHERE slug IN (
  'react-next','mobile-flutter','wordpress','logo-branding',
  'ui-design','social-media','seo','copywriting','montage','comptabilite'
);

SELECT 'skills_seed' AS key, count(*) AS count
FROM skills
WHERE slug IN (
  'react','nextjs','flutter','figma','photoshop','wordpress',
  'facebook-ads','seo','copywriting','python'
);

SELECT slug, name_fr FROM skills
WHERE slug IN (
  'react','nextjs','flutter','figma','photoshop','wordpress',
  'facebook-ads','seo','copywriting','python'
);

-- ── 8. TABLES ADDITIONNELLES ─────────────────────────────────────────
SELECT '=== TABLES ADDITIONNELLES ===' AS section, NULL::int AS count, NULL AS detail;

SELECT 'admin_roles_demo' AS key, count(*) AS count
FROM admin_roles
WHERE profile_id::text LIKE '30000000-0000-0000-0000-%';

SELECT 'project_proposals_demo' AS key, count(*) AS count
FROM project_proposals
WHERE
  freelance_id::text LIKE '20000000-0000-0000-0000-%'
  OR project_id::text LIKE '50000000-0000-0000-0000-%'
  OR project_id IN (
    SELECT id FROM projects WHERE client_id::text LIKE '10000000-0000-0000-0000-%'
  );

-- Vérifier si des tables optionnelles contiennent des données seed
SELECT 'kyc_cases_demo' AS key, count(*) AS count
FROM kyc_cases
WHERE user_id::text LIKE '10000000-0000-0000-0000-%'
   OR user_id::text LIKE '20000000-0000-0000-0000-%';

SELECT 'notifications_demo' AS key, count(*) AS count
FROM notifications
WHERE user_id::text LIKE '10000000-0000-0000-0000-%'
   OR user_id::text LIKE '20000000-0000-0000-0000-%'
   OR user_id::text LIKE '30000000-0000-0000-0000-%';

SELECT 'disputes_demo' AS key, count(*) AS count
FROM disputes
WHERE
  client_id::text LIKE '10000000-0000-0000-0000-%'
  OR freelance_id::text LIKE '20000000-0000-0000-0000-%';

SELECT 'favorite_services_demo' AS key, count(*) AS count
FROM favorite_services
WHERE user_id::text LIKE '10000000-0000-0000-0000-%'
   OR user_id::text LIKE '20000000-0000-0000-0000-%';

SELECT 'favorite_projects_demo' AS key, count(*) AS count
FROM favorite_projects
WHERE user_id::text LIKE '10000000-0000-0000-0000-%'
   OR user_id::text LIKE '20000000-0000-0000-0000-%';

SELECT 'contracts_demo' AS key, count(*) AS count
FROM contracts
WHERE
  client_id::text LIKE '10000000-0000-0000-0000-%'
  OR freelance_id::text LIKE '20000000-0000-0000-0000-%';

-- ── 9. RÉSUMÉ FINAL ──────────────────────────────────────────────────
SELECT '=== RÉSUMÉ ===' AS section, NULL::int AS count, NULL AS detail;

SELECT
  (SELECT count(*) FROM profiles WHERE id::text LIKE '10000000-0000-0000-0000-%' OR id::text LIKE '20000000-0000-0000-0000-%' OR id::text LIKE '30000000-0000-0000-0000-%') AS profils_demo,
  (SELECT count(*) FROM profiles WHERE id::text NOT LIKE '10000000-0000-0000-0000-%' AND id::text NOT LIKE '20000000-0000-0000-0000-%' AND id::text NOT LIKE '30000000-0000-0000-0000-%') AS profils_reels,
  (SELECT count(*) FROM services WHERE freelance_id::text LIKE '20000000-0000-0000-0000-%') AS services_demo,
  (SELECT count(*) FROM projects WHERE id::text LIKE '50000000-0000-0000-0000-%' OR client_id::text LIKE '10000000-0000-0000-0000-%') AS projets_demo,
  (SELECT count(*) FROM orders WHERE client_id::text LIKE '10000000-0000-0000-0000-%' OR freelance_id::text LIKE '20000000-0000-0000-0000-%') AS commandes_demo;
