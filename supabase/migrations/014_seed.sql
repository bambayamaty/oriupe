-- ═══════════════════════════════════════════════════════════════════
-- 014_seed.sql — Données réalistes pour développement & démo
-- ATTENTION: Ne pas exécuter en PRODUCTION
-- ═══════════════════════════════════════════════════════════════════

-- ── Sous-catégories ──────────────────────────────────────────────────
INSERT INTO subcategories (category_id, slug, name_fr) VALUES
  ((SELECT id FROM categories WHERE slug = 'dev-web-mobile'), 'react-next', 'React / Next.js'),
  ((SELECT id FROM categories WHERE slug = 'dev-web-mobile'), 'mobile-flutter', 'Flutter / Mobile'),
  ((SELECT id FROM categories WHERE slug = 'dev-web-mobile'), 'wordpress', 'WordPress'),
  ((SELECT id FROM categories WHERE slug = 'design-ux'), 'logo-branding', 'Logo & Branding'),
  ((SELECT id FROM categories WHERE slug = 'design-ux'), 'ui-design', 'UI Design'),
  ((SELECT id FROM categories WHERE slug = 'marketing'), 'social-media', 'Social Media'),
  ((SELECT id FROM categories WHERE slug = 'marketing'), 'seo', 'SEO / Référencement'),
  ((SELECT id FROM categories WHERE slug = 'redaction'), 'copywriting', 'Copywriting'),
  ((SELECT id FROM categories WHERE slug = 'video-motion'), 'montage', 'Montage vidéo'),
  ((SELECT id FROM categories WHERE slug = 'finance-compta'), 'comptabilite', 'Comptabilité');

-- ── Compétences populaires ───────────────────────────────────────────
INSERT INTO skills (slug, name_fr, category_id) VALUES
  ('react', 'React.js', (SELECT id FROM categories WHERE slug = 'dev-web-mobile')),
  ('nextjs', 'Next.js', (SELECT id FROM categories WHERE slug = 'dev-web-mobile')),
  ('flutter', 'Flutter', (SELECT id FROM categories WHERE slug = 'dev-web-mobile')),
  ('figma', 'Figma', (SELECT id FROM categories WHERE slug = 'design-ux')),
  ('photoshop', 'Photoshop', (SELECT id FROM categories WHERE slug = 'design-ux')),
  ('wordpress', 'WordPress', (SELECT id FROM categories WHERE slug = 'dev-web-mobile')),
  ('facebook-ads', 'Facebook Ads', (SELECT id FROM categories WHERE slug = 'marketing')),
  ('seo', 'SEO', (SELECT id FROM categories WHERE slug = 'marketing')),
  ('copywriting', 'Copywriting', (SELECT id FROM categories WHERE slug = 'redaction')),
  ('python', 'Python', (SELECT id FROM categories WHERE slug = 'dev-web-mobile'));

-- ── Profils utilisateurs demo ────────────────────────────────────────
-- Note: en prod, les profils sont créés via fn_create_profile_after_signup
-- Ici on insère directement avec des UUIDs fictifs

-- Clients
INSERT INTO profiles (id, first_name, last_name, email, role, account_status, kyc_status, is_kyc_verified, country_code, city, currency) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Awa',      'Mbaye',      'awa.mbaye@oriupe.com',      'client', 'active', 'approved', TRUE, 'SN', 'Dakar',       'XOF'),
  ('10000000-0000-0000-0000-000000000002', 'Ibrahim',  'Coulibaly',  'ibrahim.c@oriupe.com',      'client', 'active', 'approved', TRUE, 'CI', 'Abidjan',     'XOF'),
  ('10000000-0000-0000-0000-000000000003', 'Fatou',    'Diallo',     'fatou.d@oriupe.com',        'client', 'active', 'approved', TRUE, 'GH', 'Accra',       'GHS'),
  ('10000000-0000-0000-0000-000000000004', 'Chukwudi', 'Okonkwo',    'chukwudi@oriupe.com',       'client', 'active', 'approved', TRUE, 'NG', 'Lagos',       'NGN'),
  ('10000000-0000-0000-0000-000000000005', 'Marie',    'Ndoye',      'marie.ndoye@oriupe.com',    'client', 'active', 'approved', TRUE, 'SN', 'Dakar',       'XOF'),
  ('10000000-0000-0000-0000-000000000006', 'Yussuf',   'Kamara',     'yussuf.k@oriupe.com',       'client', 'active', 'approved', TRUE, 'CI', 'Abidjan',     'XOF'),
  ('10000000-0000-0000-0000-000000000007', 'Aminata',  'Touré',      'aminata.t@oriupe.com',      'client', 'active', 'approved', TRUE, 'ML', 'Bamako',      'XOF'),
  ('10000000-0000-0000-0000-000000000008', 'Emeka',    'Nwosu',      'emeka.n@oriupe.com',        'client', 'active', 'approved', TRUE, 'NG', 'Abuja',       'NGN'),
  ('10000000-0000-0000-0000-000000000009', 'Sandrine', 'Belinga',    'sandrine.b@oriupe.com',     'client', 'active', 'approved', TRUE, 'CM', 'Yaoundé',     'XAF'),
  ('10000000-0000-0000-0000-000000000010', 'Oumar',    'Ba',         'oumar.ba@oriupe.com',       'client', 'active', 'approved', TRUE, 'SN', 'Thiès',       'XOF');

-- Freelances
INSERT INTO profiles (id, first_name, last_name, email, role, account_status, kyc_status, is_kyc_verified, country_code, city, currency) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Kofi',     'Asante',     'kofi.asante@oriupe.com',    'freelance', 'active', 'approved', TRUE, 'GH', 'Accra',    'GHS'),
  ('20000000-0000-0000-0000-000000000002', 'Moussa',   'Traoré',     'moussa.t@oriupe.com',       'freelance', 'active', 'approved', TRUE, 'CI', 'Abidjan',  'XOF'),
  ('20000000-0000-0000-0000-000000000003', 'Aïssatou', 'Sow',        'aissatou.sow@oriupe.com',   'freelance', 'active', 'approved', TRUE, 'SN', 'Dakar',    'XOF'),
  ('20000000-0000-0000-0000-000000000004', 'Daniel',   'Osei',       'daniel.osei@oriupe.com',    'freelance', 'active', 'approved', TRUE, 'GH', 'Kumasi',   'GHS'),
  ('20000000-0000-0000-0000-000000000005', 'Adaeze',   'Eze',        'adaeze.eze@oriupe.com',     'freelance', 'active', 'approved', TRUE, 'NG', 'Lagos',    'NGN'),
  ('20000000-0000-0000-0000-000000000006', 'Seun',     'Adeyemi',    'seun.a@oriupe.com',         'freelance', 'active', 'approved', TRUE, 'NG', 'Lagos',    'NGN'),
  ('20000000-0000-0000-0000-000000000007', 'Bocar',    'Diallo',     'bocar.d@oriupe.com',        'freelance', 'active', 'approved', TRUE, 'SN', 'Saint-Louis','XOF'),
  ('20000000-0000-0000-0000-000000000008', 'Cynthia',  'Ntombela',   'cynthia.n@oriupe.com',      'freelance', 'active', 'approved', TRUE, 'CI', 'Abidjan',  'XOF'),
  ('20000000-0000-0000-0000-000000000009', 'Ouédraogo','Serge',       'serge.o@oriupe.com',        'freelance', 'active', 'approved', TRUE, 'BF', 'Ouagadougou','XOF'),
  ('20000000-0000-0000-0000-000000000010', 'Léa',      'Mendy',      'lea.mendy@oriupe.com',      'freelance', 'active', 'approved', TRUE, 'SN', 'Ziguinchor','XOF'),
  ('20000000-0000-0000-0000-000000000011', 'Kwabena',  'Boateng',    'kwabena.b@oriupe.com',      'freelance', 'active', 'approved', TRUE, 'GH', 'Accra',    'GHS'),
  ('20000000-0000-0000-0000-000000000012', 'Nadia',    'Benchekroun','nadia.bench@oriupe.com',    'freelance', 'active', 'approved', TRUE, 'MA', 'Casablanca','MAD'),
  ('20000000-0000-0000-0000-000000000013', 'Jules',    'Ateba',      'jules.a@oriupe.com',        'freelance', 'active', 'approved', TRUE, 'CM', 'Douala',   'XAF'),
  ('20000000-0000-0000-0000-000000000014', 'Grace',    'Wanjiku',    'grace.w@oriupe.com',        'freelance', 'active', 'approved', TRUE, 'KE', 'Nairobi',  'KES'),
  ('20000000-0000-0000-0000-000000000015', 'Mamadou',  'Kouyaté',    'mamadou.k@oriupe.com',      'freelance', 'active', 'approved', TRUE, 'ML', 'Bamako',   'XOF');

-- Admins
INSERT INTO profiles (id, first_name, last_name, email, role, account_status, kyc_status, is_kyc_verified) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Super',    'Admin',      'admin@oriupe.com',          'admin', 'active', 'approved', TRUE),
  ('30000000-0000-0000-0000-000000000002', 'Sam',      'Modérateur', 'moderateur@oriupe.com',     'admin', 'active', 'approved', TRUE),
  ('30000000-0000-0000-0000-000000000003', 'Sarah',    'Support',    'support@oriupe.com',        'admin', 'active', 'approved', TRUE),
  ('30000000-0000-0000-0000-000000000004', 'Félicia',  'Finance',    'finance@oriupe.com',        'admin', 'active', 'approved', TRUE),
  ('30000000-0000-0000-0000-000000000005', 'Team',     'Oriupe',     'team@oriupe.com',           'admin', 'active', 'approved', TRUE),
  ('30000000-0000-0000-0000-000000000006', 'Dev',      'Oriupe',     'dev@oriupe.com',            'admin', 'active', 'approved', TRUE);

-- Rôles admin
INSERT INTO admin_roles (profile_id, role, granted_by) VALUES
  ('30000000-0000-0000-0000-000000000001', 'super_admin', '30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', 'moderator',   '30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003', 'support',     '30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000004', 'finance',     '30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000005', 'admin',       '30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000006', 'admin',       '30000000-0000-0000-0000-000000000001');

-- Sous-profils clients
INSERT INTO client_profiles (profile_id) VALUES
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000007'),
  ('10000000-0000-0000-0000-000000000008'),
  ('10000000-0000-0000-0000-000000000009'),
  ('10000000-0000-0000-0000-000000000010');

-- Sous-profils freelances
INSERT INTO freelance_profiles (profile_id, slug, professional_title, bio, level, avg_rating, review_count, completed_orders)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'kofi-asante',  'Développeur React & Next.js',  'Expert en développement web React avec 5 ans d''expérience. Spécialisé dans les applications performantes et les dashboards.', 'expert',     4.85, 42, 38),
  ('20000000-0000-0000-0000-000000000002', 'moussa-traore', 'Designer UI/UX',               'Créateur de designs modernes et accessibles. Maîtrise Figma, Adobe XD. Nombreux projets fintech africaines.', 'expert',     4.90, 67, 61),
  ('20000000-0000-0000-0000-000000000003', 'aissatou-sow',  'Copywriter & Content Strategist', 'Copywriter spécialisée en marketing digital africain. Brand storytelling et stratégie de contenu.', 'confirmed',  4.70, 29, 26),
  ('20000000-0000-0000-0000-000000000004', 'daniel-osei',   'Développeur Flutter',          'Apps cross-platform iOS & Android. Intégrations Mobile Money (Orange, MTN, Wave).', 'confirmed',  4.60, 18, 16),
  ('20000000-0000-0000-0000-000000000005', 'adaeze-eze',    'Experte Marketing Digital',    'Growth hacker spécialisée dans les marchés africains. Facebook Ads, TikTok, Google Ads.', 'top_oriupe', 4.95, 89, 82),
  ('20000000-0000-0000-0000-000000000006', 'seun-adeyemi',  'Développeur Full Stack',       'Node.js, React, PostgreSQL. Architectures API REST et microservices.', 'confirmed',  4.55, 22, 20),
  ('20000000-0000-0000-0000-000000000007', 'bocar-diallo',  'Motion Designer',              'Animations After Effects, Premiere Pro. Vidéos publicitaires et contenus réseaux sociaux.', 'new',        4.40, 8,  7),
  ('20000000-0000-0000-0000-000000000008', 'cynthia-ntombela', 'Développeuse WordPress',   'Sites vitrine, e-commerce WooCommerce et marketplaces. SEO technique.', 'confirmed',  4.65, 34, 31),
  ('20000000-0000-0000-0000-000000000009', 'serge-ouedraogo', 'Expert Comptable',          'Comptabilité, déclarations fiscales UEMOA, business plans et états financiers.', 'expert',     4.80, 51, 47),
  ('20000000-0000-0000-0000-000000000010', 'lea-mendy',     'Graphiste & Illustratrice',   'Illustrations vectorielles, chartes graphiques, packaging. Style africain contemporain.', 'confirmed',  4.72, 27, 24),
  ('20000000-0000-0000-0000-000000000011', 'kwabena-boateng', 'Développeur Python & Data', 'Analyse de données, scraping, automatisations. Machine learning basique.', 'confirmed',  4.50, 15, 13),
  ('20000000-0000-0000-0000-000000000012', 'nadia-benchekroun', 'Traductrice FR/AR/EN',    'Traduction certifiée français, arabe, anglais. Spécialisée documents juridiques et techniques.', 'new',       4.30, 6,  5),
  ('20000000-0000-0000-0000-000000000013', 'jules-ateba',   'Community Manager',           'Gestion communautés Instagram, Facebook, LinkedIn pour entreprises africaines.', 'confirmed',  4.58, 31, 28),
  ('20000000-0000-0000-0000-000000000014', 'grace-wanjiku',  'Formatrice Business',        'Coaching entrepreneuriat, formations business plan, pitch deck. East Africa focus.', 'new',        4.20, 4,  3),
  ('20000000-0000-0000-0000-000000000015', 'mamadou-kouyate', 'Développeur Backend',       'Laravel, Node.js, intégrations CinetPay, Orange Money API. Expérience startups fintech.', 'expert',    4.88, 56, 52);

-- ── Services (25) ────────────────────────────────────────────────────
-- Note: slugs et search_vector générés automatiquement

INSERT INTO services (id, freelance_id, category_id, title, short_description, base_price_cents, base_delivery_days, base_revisions, status, published_at)
SELECT
  gen_random_uuid(),
  fp.id,
  c.id,
  title, short_desc, price, days, revs, 'published', NOW() - (RANDOM()*60 || ' days')::INTERVAL
FROM (VALUES
  ('kofi-asante',      'dev-web-mobile', 'Application React complète avec auth Supabase', 'Dashboard, CRUD, auth JWT, mobile responsive.', 15000000, 14, 2),
  ('kofi-asante',      'dev-web-mobile', 'Landing page React haute conversion', 'Page marketing A/B testée, animations, GTM intégré.', 5000000, 7, 2),
  ('moussa-traore',    'design-ux',      'Design UI complet application mobile', 'Maquettes Figma annotées, design system, prototype.', 8000000, 10, 3),
  ('moussa-traore',    'design-ux',      'Création logo & identité visuelle', 'Logo vectoriel + charte + guide d''utilisation.', 4500000, 7, 3),
  ('aissatou-sow',     'redaction',      'Pack contenu réseaux sociaux (30 posts)', '30 posts Instagram/Facebook avec visuels. Calendrier éditorial.', 3000000, 10, 2),
  ('aissatou-sow',     'redaction',      'Article de blog SEO optimisé (2000 mots)', 'Recherche mots-clés, rédaction expert, maillage interne.', 1500000, 5, 2),
  ('daniel-osei',      'dev-web-mobile', 'Application Flutter iOS & Android', 'UI responsive, Mobile Money intégré, notifications push.', 20000000, 21, 2),
  ('adaeze-eze',       'marketing',      'Campagne Facebook Ads clé en main', 'Stratégie, création visuels, lancement, reporting mensuel.', 4000000, 7, 2),
  ('adaeze-eze',       'marketing',      'Audit marketing digital complet', 'Analyse SEO, Social, Ads, CRO. Rapport détaillé + plan action.', 3500000, 5, 2),
  ('seun-adeyemi',     'dev-web-mobile', 'API REST Node.js + documentation', 'Endpoints RESTful, auth JWT, Swagger, tests unitaires.', 10000000, 14, 2),
  ('bocar-diallo',     'video-motion',   'Publicité animée 30 secondes (After Effects)', 'Motion design professionnel pour réseaux sociaux.', 4000000, 10, 3),
  ('cynthia-ntombela', 'dev-web-mobile', 'Site WordPress professionnel (5 pages)', 'Thème premium, SEO on-page, responsive, formulaire de contact.', 3500000, 10, 2),
  ('cynthia-ntombela', 'dev-web-mobile', 'WooCommerce e-commerce jusqu''à 100 produits', 'Configuration, paiement, livraison, emails auto.', 6000000, 14, 2),
  ('serge-ouedraogo',  'finance-compta', 'Plan comptable + déclarations fiscales mensuelles', 'Suivi comptable complet SYSCOHADA, TVA, impôts.', 5000000, 7, 1),
  ('serge-ouedraogo',  'finance-compta', 'Business plan investisseur (30 pages)', 'Analyse marché, projections financières 3 ans, pitch.', 7500000, 14, 2),
  ('lea-mendy',        'design-ux',      'Illustration personnalisée (style africain)', 'Illustration vectorielle unique + formats PNG/SVG/PDF.', 3000000, 7, 3),
  ('kwabena-boateng',  'dev-web-mobile', 'Script Python scraping + data processing', 'Extraction, nettoyage, export CSV/Excel. Cron planifié.', 4000000, 7, 2),
  ('nadia-benchekroun','redaction',      'Traduction document FR/EN (jusqu''à 5000 mots)', 'Traduction certifiée, relecture native.', 2000000, 5, 1),
  ('jules-ateba',      'marketing',      'Gestion réseaux sociaux (1 mois)', '3 posts/semaine Instagram + Facebook. Réponses DM inclus.', 4500000, 30, 1),
  ('grace-wanjiku',    'formation',      'Coaching business plan (3 sessions)', '3 sessions 90 min + support WhatsApp entre sessions.', 4500000, 21, 1),
  ('mamadou-kouyate',  'dev-web-mobile', 'Intégration paiement Mobile Money (Orange/MTN/Wave)', 'CinetPay ou FedaPay. Tests, webhooks, documentation.', 8000000, 7, 2),
  ('mamadou-kouyate',  'dev-web-mobile', 'Backend Laravel API pour marketplace', 'Auth, CRUD, paiement, notifications. Tests et déploiement.', 18000000, 21, 2),
  ('kofi-asante',      'dev-web-mobile', 'Optimisation performance React app', 'Lighthouse audit, lazy loading, bundle splitting, CDN.', 4000000, 5, 2),
  ('adaeze-eze',       'marketing',      'Stratégie de lancement produit digital', 'Go-to-market, plan contenu, KPIs, budget pub initial.', 6000000, 10, 2),
  ('moussa-traore',    'design-ux',      'Refonte UX/UI dashboard SaaS', 'Audit UX, wireframes, maquettes Figma, handoff développeur.', 12000000, 14, 3)
) AS t(slug, cat_slug, title, short_desc, price, days, revs)
JOIN freelance_profiles fp ON fp.slug = t.slug
JOIN categories c ON c.slug = t.cat_slug;

-- Packages Basique pour les premiers services
INSERT INTO service_packages (service_id, name, description, price_cents, delivery_days, revisions, sort_order)
SELECT
  s.id,
  'Basique',
  'Livrable essentiel, délai standard.',
  s.base_price_cents,
  s.base_delivery_days,
  s.base_revisions,
  0
FROM services s
WHERE s.status = 'published';

-- Package Standard (1.8x)
INSERT INTO service_packages (service_id, name, description, price_cents, delivery_days, revisions, sort_order)
SELECT
  s.id,
  'Standard',
  'Livrable complet avec options supplémentaires.',
  ROUND(s.base_price_cents * 1.8)::BIGINT,
  s.base_delivery_days + 3,
  s.base_revisions + 2,
  1
FROM services s
WHERE s.status = 'published';

-- Package Premium (3x)
INSERT INTO service_packages (service_id, name, description, price_cents, delivery_days, revisions, sort_order)
SELECT
  s.id,
  'Premium',
  'Service complet, prioritaire, révisions illimitées.',
  ROUND(s.base_price_cents * 3)::BIGINT,
  ROUND(s.base_delivery_days * 1.5)::INT,
  999,
  2
FROM services s
WHERE s.status = 'published';

-- ── Projets clients (10) ─────────────────────────────────────────────
INSERT INTO projects (id, client_id, category_id, title, description, budget_min_cents, budget_max_cents, deadline, type, status, published_at, proposal_count)
VALUES
  ('50000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   (SELECT id FROM categories WHERE slug = 'dev-web-mobile'),
   'Application mobile de gestion de tontines',
   'Je cherche un développeur Flutter pour créer une app iOS/Android permettant de gérer des tontines (groupes d''épargne). Fonctionnalités: inscription membres, calendrier versements, notifications, historique, Mobile Money.',
   8000000, 20000000, NOW() + INTERVAL '30 days', 'public_tender', 'open', NOW() - INTERVAL '3 days', 4),

  ('50000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002',
   (SELECT id FROM categories WHERE slug = 'design-ux'),
   'Refonte identité visuelle startup fintech',
   'Ma startup fintech a besoin d''une nouvelle identité : logo, couleurs, typographie, charte. Nous ciblons les PME africaines. Style professionnel, moderne, confiance.',
   3000000, 7000000, NOW() + INTERVAL '14 days', 'public_tender', 'open', NOW() - INTERVAL '5 days', 6),

  ('50000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000003',
   (SELECT id FROM categories WHERE slug = 'marketing'),
   'Stratégie marketing lancement e-commerce mode',
   'Lancement boutique en ligne vêtements africains. Besoin d''une stratégie complète: réseaux sociaux, influenceurs, SEO, email. Budget pub 500k/mois.',
   5000000, 12000000, NOW() + INTERVAL '21 days', 'public_tender', 'open', NOW() - INTERVAL '2 days', 3),

  ('50000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000004',
   (SELECT id FROM categories WHERE slug = 'dev-web-mobile'),
   'Développement plateforme e-learning',
   'Plateforme de formation en ligne pour entrepreneurs africains. Vidéos, quiz, certificats, forums. Paiement Mobile Money. Stack suggérée: Next.js + Supabase.',
   25000000, 50000000, NOW() + INTERVAL '45 days', 'public_tender', 'open', NOW() - INTERVAL '7 days', 8),

  ('50000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000005',
   (SELECT id FROM categories WHERE slug = 'redaction'),
   'Rédaction 20 articles blog SEO (secteur agriculture)',
   '20 articles optimisés SEO pour un site agriculture africaine. 1500-2000 mots chacun. Recherche mots-clés fournie, rédaction en français.',
   4000000, 8000000, NOW() + INTERVAL '30 days', 'public_tender', 'open', NOW() - INTERVAL '1 day', 2),

  ('50000000-0000-0000-0000-000000000006',
   '10000000-0000-0000-0000-000000000006',
   (SELECT id FROM categories WHERE slug = 'finance-compta'),
   'Business plan levée de fonds Série A (500k USD)',
   'Business plan complet pour une levée de fonds. Analyse marché, modèle financier 5 ans, pitch deck. Entreprise SaaS B2B.',
   6000000, 15000000, NOW() + INTERVAL '21 days', 'public_tender', 'open', NOW() - INTERVAL '4 days', 5),

  ('50000000-0000-0000-0000-000000000007',
   '10000000-0000-0000-0000-000000000007',
   (SELECT id FROM categories WHERE slug = 'video-motion'),
   'Vidéo présentation entreprise 2 minutes',
   'Vidéo corporate professionnelle pour LinkedIn et site web. Tournage inclus (Bamako). Script, montage, motion graphics, musique.',
   3000000, 6000000, NOW() + INTERVAL '15 days', 'public_tender', 'open', NOW() - INTERVAL '6 days', 3),

  ('50000000-0000-0000-0000-000000000008',
   '10000000-0000-0000-0000-000000000008',
   (SELECT id FROM categories WHERE slug = 'dev-web-mobile'),
   'API intégration Orange Money pour marketplace',
   'Intégration API Orange Money CI pour notre marketplace. Dépôt, retrait, vérification KYC, webhooks. Documentation et tests requis.',
   5000000, 10000000, NOW() + INTERVAL '14 days', 'direct_order', 'open',
   NOW() - INTERVAL '2 days', 1),

  ('50000000-0000-0000-0000-000000000009',
   '10000000-0000-0000-0000-000000000009',
   (SELECT id FROM categories WHERE slug = 'design-ux'),
   'Design kit UI (50 composants) pour app mobile',
   'Design system complet Figma: 50 composants UI, dark/light mode, tokens de design, documentation. Compatible React Native.',
   8000000, 15000000, NOW() + INTERVAL '21 days', 'public_tender', 'open', NOW() - INTERVAL '3 days', 4),

  ('50000000-0000-0000-0000-000000000010',
   '10000000-0000-0000-0000-000000000010',
   (SELECT id FROM categories WHERE slug = 'formation'),
   'Formation équipe commerciale (10 personnes, 3 jours)',
   'Formation intensive techniques de vente pour PME africaines. Présentielle à Thiès + supports. Méthodes adaptées marché local.',
   3000000, 7000000, NOW() + INTERVAL '30 days', 'public_tender', 'open', NOW() - INTERVAL '5 days', 2);

-- ── Commandes (15) ───────────────────────────────────────────────────
-- Insérer 8 commandes avec escrow complet
DO $$
DECLARE
  orders_data RECORD;
  v_order_id UUID;
  v_escrow_id UUID;
  v_conv_id UUID;
  v_code TEXT;
  v_ref TEXT;
  i INT := 1;
BEGIN
  FOR orders_data IN
    SELECT * FROM (VALUES
      -- (client_id, freelance_slug, service_title_prefix, amount, status, paid)
      ('10000000-0000-0000-0000-000000000001', 'kofi-asante',      'Application React',     15000000, 'completed', TRUE),
      ('10000000-0000-0000-0000-000000000002', 'moussa-traore',    'Design UI complet',      8000000, 'in_progress', TRUE),
      ('10000000-0000-0000-0000-000000000003', 'adaeze-eze',       'Campagne Facebook Ads',  4000000, 'delivered', TRUE),
      ('10000000-0000-0000-0000-000000000004', 'mamadou-kouyate',  'Intégration Mobile Money',8000000, 'paid', TRUE),
      ('10000000-0000-0000-0000-000000000005', 'serge-ouedraogo',  'Business plan',           7500000, 'completed', TRUE),
      ('10000000-0000-0000-0000-000000000006', 'cynthia-ntombela', 'Site WordPress',          3500000, 'in_progress', TRUE),
      ('10000000-0000-0000-0000-000000000007', 'aissatou-sow',     'Pack contenu réseaux',   3000000, 'pending_payment', FALSE),
      ('10000000-0000-0000-0000-000000000008', 'kofi-asante',      'Landing page React',     5000000, 'disputed', TRUE),
      ('10000000-0000-0000-0000-000000000009', 'moussa-traore',    'Logo & identité',         4500000, 'completed', TRUE),
      ('10000000-0000-0000-0000-000000000010', 'seun-adeyemi',     'API REST Node.js',       10000000, 'revision_requested', TRUE),
      ('10000000-0000-0000-0000-000000000001', 'lea-mendy',        'Illustration',            3000000, 'pending_payment', FALSE),
      ('10000000-0000-0000-0000-000000000002', 'bocar-diallo',     'Publicité animée',        4000000, 'in_progress', TRUE),
      ('10000000-0000-0000-0000-000000000003', 'kwabena-boateng',  'Script Python',           4000000, 'completed', TRUE),
      ('10000000-0000-0000-0000-000000000004', 'serge-ouedraogo',  'Plan comptable',          5000000, 'paid', TRUE),
      ('10000000-0000-0000-0000-000000000005', 'daniel-osei',      'App Flutter',            20000000, 'in_progress', TRUE)
    ) AS t(client_id, freelance_slug, svc_title, amount, ord_status, paid)
  LOOP
    v_ref  := 'ORD-2026-' || LPAD(i::TEXT, 6, '0');
    v_code := 'ESC-26-' || upper(substring(md5(random()::text) from 1 for 8));
    v_order_id := gen_random_uuid();

    INSERT INTO orders (
      id, client_id, freelance_id, source, ref, title,
      amount_total_cents, commission_rate, currency,
      delivery_days, revisions_included,
      status, escrow_code, deadline,
      paid_at, started_at, completed_at
    )
    SELECT
      v_order_id,
      orders_data.client_id::UUID,
      fp.id,
      'service',
      v_ref,
      orders_data.svc_title,
      orders_data.amount,
      0.15,
      'XOF',
      14, 2,
      orders_data.ord_status::order_status,
      v_code,
      NOW() + INTERVAL '14 days',
      CASE WHEN orders_data.paid THEN NOW() - INTERVAL '10 days' ELSE NULL END,
      CASE WHEN orders_data.ord_status IN ('in_progress','delivered','completed','disputed','revision_requested') THEN NOW() - INTERVAL '8 days' ELSE NULL END,
      CASE WHEN orders_data.ord_status = 'completed' THEN NOW() - INTERVAL '2 days' ELSE NULL END
    FROM freelance_profiles fp
    WHERE fp.slug = orders_data.freelance_slug;

    -- Escrow correspondant
    INSERT INTO escrow_transactions (
      order_id, status, amount_total_cents,
      amount_secured_cents, amount_released_cents,
      payment_operator, payment_provider
    ) VALUES (
      v_order_id,
      CASE orders_data.ord_status
        WHEN 'pending_payment'       THEN 'awaiting_payment'
        WHEN 'paid'                  THEN 'funds_secured'
        WHEN 'in_progress'           THEN 'in_progress'
        WHEN 'delivered'             THEN 'delivered'
        WHEN 'revision_requested'    THEN 'in_progress'
        WHEN 'completed'             THEN 'completed'
        WHEN 'disputed'              THEN 'disputed'
        ELSE 'awaiting_payment'
      END::escrow_status,
      orders_data.amount,
      CASE WHEN orders_data.paid THEN orders_data.amount ELSE 0 END,
      CASE WHEN orders_data.ord_status = 'completed' THEN orders_data.amount ELSE 0 END,
      CASE WHEN orders_data.paid THEN 'orange_money' ELSE NULL END,
      CASE WHEN orders_data.paid THEN 'cinetpay' ELSE NULL END
    );

    -- Conversation associée
    INSERT INTO conversations (type, order_id, created_by, last_message_at)
    SELECT 'order', v_order_id, orders_data.client_id::UUID, NOW() - (RANDOM()*5 || ' days')::INTERVAL
    RETURNING id INTO v_conv_id;

    -- Participants
    INSERT INTO conversation_participants (conversation_id, user_id)
    SELECT v_conv_id, orders_data.client_id::UUID
    UNION ALL
    SELECT v_conv_id, fp.profile_id
    FROM freelance_profiles fp WHERE fp.slug = orders_data.freelance_slug;

    i := i + 1;
  END LOOP;
END;
$$;

-- Messages dans les conversations
INSERT INTO messages (conversation_id, sender_id, type, body, created_at)
SELECT
  c.id,
  cp.user_id,
  'text',
  msgs.body,
  NOW() - (RANDOM()*5 || ' days')::INTERVAL
FROM conversations c
JOIN LATERAL (
  SELECT user_id FROM conversation_participants WHERE conversation_id = c.id LIMIT 1
) cp ON TRUE
JOIN LATERAL (
  SELECT unnest(ARRAY[
    'Bonjour ! Ravi de travailler avec vous sur ce projet.',
    'J''ai bien reçu vos instructions. Je commence dès demain.',
    'Voici mes premières questions sur le brief...',
    'J''ai terminé la première partie. Que pensez-vous ?',
    'Parfait ! Vous pouvez continuer comme ça.',
    'Petite question sur le délai — est-ce flexible ?',
    'Livraison disponible dans votre espace escrow.',
    'Merci pour la validation. C''était un plaisir !'
  ]) AS body
) msgs ON TRUE
WHERE c.type = 'order'
LIMIT 80;

-- ── Avis (10) ────────────────────────────────────────────────────────
INSERT INTO reviews (order_id, freelance_id, author_id, rating, rating_quality, rating_communication, rating_deadline, comment, is_public)
SELECT
  o.id,
  o.freelance_id,
  o.client_id,
  ratings.r,
  ratings.q,
  ratings.c,
  ratings.d,
  ratings.comment,
  TRUE
FROM orders o
JOIN (VALUES
  (1, 5, 5, 5, 5, 'Travail exceptionnel, livré avant le délai. Je recommande vivement !'),
  (2, 5, 4, 5, 5, 'Design magnifique et très professionnel. Superbe collaboration.'),
  (3, 4, 5, 4, 4, 'Bonne campagne, résultats positifs. Communication fluide.'),
  (4, 5, 5, 5, 5, 'Intégration parfaite, zéro bug en production. Top développeur.'),
  (5, 5, 5, 5, 4, 'Business plan de qualité, bien structuré. Financement obtenu !')
) AS ratings(n, r, q, c, d, comment) ON TRUE
WHERE o.status = 'completed'
LIMIT 5;
