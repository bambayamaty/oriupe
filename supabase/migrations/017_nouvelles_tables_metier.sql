-- ═══════════════════════════════════════════════════════════════════
-- 017_nouvelles_tables_metier.sql — Logique métier avancée
-- Anti-fraude · Pénalités retard · Health score · Bypass ·
-- Rappels intelligents · Rapports financiers mensuels
-- ═══════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════
-- 1. PROTECTION ANTI-FRAUDE
-- ════════════════════════════════════════════

CREATE TABLE fraude_tentatives (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  type_fraude     TEXT        NOT NULL CHECK (type_fraude IN (
    'doublon_paiement',
    'methode_paiement_suspecte',
    'montant_anormal',
    'velocity_exceeded',
    'same_device_multiple_accounts',
    'card_testing'
  )),

  details         JSONB       NOT NULL DEFAULT '{}',
  ip_address      INET,
  user_agent      TEXT,
  device_id       TEXT,         -- empreinte appareil

  severite        TEXT        NOT NULL DEFAULT 'medium'
    CHECK (severite IN ('low', 'medium', 'high', 'critical')),

  -- Traitement
  resolu          BOOLEAN     NOT NULL DEFAULT FALSE,
  resolu_le       TIMESTAMPTZ,
  resolu_par      UUID        REFERENCES profiles(id),
  resolution_note TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraude_user_id  ON fraude_tentatives(user_id);
CREATE INDEX idx_fraude_type     ON fraude_tentatives(type_fraude);
CREATE INDEX idx_fraude_severite ON fraude_tentatives(severite) WHERE NOT resolu;
CREATE INDEX idx_fraude_ip       ON fraude_tentatives(ip_address);
CREATE INDEX idx_fraude_created  ON fraude_tentatives(created_at DESC);

ALTER TABLE fraude_tentatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fraude_admin_only" ON fraude_tentatives USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 2. PÉNALITÉS DE RETARD
-- ════════════════════════════════════════════

CREATE TABLE penalites_retard (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    UUID    NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  freelance_id                UUID    NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  jours_retard                INT     NOT NULL CHECK (jours_retard > 0),
  taux_penalite_par_jour      NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  plafond_pct                 NUMERIC(5,4) NOT NULL DEFAULT 0.30,

  -- Montants en centimes
  montant_initial_cents       BIGINT  NOT NULL,
  montant_penalite_cents      BIGINT  NOT NULL CHECK (montant_penalite_cents >= 0),
  montant_apres_penalite_cents BIGINT NOT NULL,

  -- Traçabilité
  calculee_par                TEXT    NOT NULL DEFAULT 'system',  -- 'system' ou uuid admin
  appliquee_le                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  justification               TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_penalites_order_id    ON penalites_retard(order_id);
CREATE INDEX idx_penalites_freelance   ON penalites_retard(freelance_id);

ALTER TABLE penalites_retard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "penalites_select_freelance" ON penalites_retard
  FOR SELECT USING (auth.uid() = freelance_id);
CREATE POLICY "penalites_admin"            ON penalites_retard USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 3. HEALTH SCORE FREELANCE
-- ════════════════════════════════════════════

CREATE TABLE freelance_health_scores (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  freelance_id                UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Période : premier lundi de la semaine
  semaine                     DATE        NOT NULL,

  -- Score global
  score                       INT         NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),

  -- Composantes (sous-scores, somme ≤ 100)
  score_completion            NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 30 pts max
  score_note_moyenne          NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 30 pts max
  score_reactivite            NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 20 pts max
  score_ponctualite           NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 20 pts max

  -- Métriques brutes de la semaine
  commandes_terminees         INT         NOT NULL DEFAULT 0,
  commandes_annulees          INT         NOT NULL DEFAULT 0,
  commandes_litiges           INT         NOT NULL DEFAULT 0,
  note_moyenne                NUMERIC(3,2),
  temps_reponse_moyen_minutes INT,
  livraisons_a_temps          INT         NOT NULL DEFAULT 0,
  livraisons_en_retard        INT         NOT NULL DEFAULT 0,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (freelance_id, semaine)
);

CREATE INDEX idx_health_freelance ON freelance_health_scores(freelance_id);
CREATE INDEX idx_health_semaine   ON freelance_health_scores(semaine DESC);

ALTER TABLE freelance_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_select_own"   ON freelance_health_scores
  FOR SELECT USING (auth.uid() = freelance_id);
CREATE POLICY "health_admin"        ON freelance_health_scores USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 4. DÉTECTION BYPASS PLATEFORME
-- ════════════════════════════════════════════

CREATE TABLE bypass_detections (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          UUID    REFERENCES messages(id) ON DELETE SET NULL,
  conversation_id     UUID    REFERENCES conversations(id) ON DELETE SET NULL,
  user_id             UUID    REFERENCES profiles(id) ON DELETE SET NULL,

  type_bypass         TEXT    NOT NULL CHECK (type_bypass IN (
    'phone_number',
    'email_address',
    'whatsapp_mention',
    'external_payment_mention',   -- "paye-moi sur Wave directement"
    'social_media_handle'
  )),

  contenu_detecte     TEXT    NOT NULL,   -- extrait original
  contenu_censure     TEXT,               -- version affichée à la place
  pattern_utilise     TEXT,               -- regex ayant matché

  action_prise        TEXT    NOT NULL DEFAULT 'flagged'
    CHECK (action_prise IN ('flagged', 'censored', 'blocked', 'warning_sent')),

  nb_occurrences_user INT     NOT NULL DEFAULT 1,  -- historique pour escalade

  traite              BOOLEAN NOT NULL DEFAULT FALSE,
  traite_le           TIMESTAMPTZ,
  traite_par          UUID    REFERENCES profiles(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bypass_message        ON bypass_detections(message_id);
CREATE INDEX idx_bypass_user_id        ON bypass_detections(user_id);
CREATE INDEX idx_bypass_traite         ON bypass_detections(traite, created_at DESC);
CREATE INDEX idx_bypass_type           ON bypass_detections(type_bypass);

ALTER TABLE bypass_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bypass_admin_only"      ON bypass_detections USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 5. RAPPELS INTELLIGENTS
-- ════════════════════════════════════════════

CREATE TABLE rappels (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  type_rappel     TEXT    NOT NULL CHECK (type_rappel IN (
    'validation_livraison',        -- Client: valider dans X jours
    'livraison_imminente',         -- Freelance: livraison dans 24h
    'livraison_retard',            -- Freelance en retard
    'kyc_incomplet',               -- Profil sans KYC valide
    'proposition_expire_bientot',  -- Proposition expire dans 6h
    'commande_sans_message',       -- Ordre créé, freelance n'a pas encore écrit
    'avis_apres_commande',         -- Demande d'avis 1h après commande terminée
    'reactivation_inactivite'      -- Utilisateur inactif depuis 30j
  )),

  -- Référence de l'entité concernée
  reference_id    UUID,
  reference_type  TEXT    CHECK (reference_type IN ('order', 'proposal', 'kyc_case', 'service')),

  -- Planification
  envoyer_le      TIMESTAMPTZ NOT NULL,
  canal           TEXT    NOT NULL DEFAULT 'in_app'
    CHECK (canal IN ('in_app', 'email', 'sms', 'all')),

  -- Exécution
  envoye          BOOLEAN NOT NULL DEFAULT FALSE,
  envoye_le       TIMESTAMPTZ,
  erreur          TEXT,           -- message d'erreur si échec

  metadata        JSONB   NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index partiel : uniquement les rappels non encore envoyés
CREATE INDEX idx_rappels_pending   ON rappels(envoyer_le ASC) WHERE NOT envoye;
CREATE INDEX idx_rappels_user      ON rappels(user_id);
CREATE INDEX idx_rappels_reference ON rappels(reference_id, reference_type);

ALTER TABLE rappels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rappels_select_own" ON rappels
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rappels_admin"      ON rappels USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 6. RAPPORTS FINANCIERS MENSUELS
-- ════════════════════════════════════════════

CREATE TABLE rapports_financiers_mensuels (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_mois                INT     NOT NULL CHECK (periode_mois BETWEEN 1 AND 12),
  periode_annee               INT     NOT NULL CHECK (periode_annee >= 2024),

  -- Volumes (en centimes)
  volume_total_cents          BIGINT  NOT NULL DEFAULT 0,
  commissions_collectees_cents BIGINT NOT NULL DEFAULT 0,
  virements_effectues_cents   BIGINT  NOT NULL DEFAULT 0,
  montant_litiges_cents       BIGINT  NOT NULL DEFAULT 0,
  montant_remboursements_cents BIGINT NOT NULL DEFAULT 0,

  -- Compteurs
  nb_commandes_completees     INT     NOT NULL DEFAULT 0,
  nb_commandes_litiges        INT     NOT NULL DEFAULT 0,
  nb_commandes_remboursees    INT     NOT NULL DEFAULT 0,
  nb_nouveaux_clients         INT     NOT NULL DEFAULT 0,
  nb_nouveaux_freelances      INT     NOT NULL DEFAULT 0,
  nb_services_publies         INT     NOT NULL DEFAULT 0,

  -- Métriques de santé
  taux_completion             NUMERIC(5,4),
  taux_litige                 NUMERIC(5,4),
  note_moyenne_plateforme     NUMERIC(3,2),

  -- Données détaillées pour graphiques
  repartition_par_categorie   JSONB   NOT NULL DEFAULT '{}',
  repartition_par_pays        JSONB   NOT NULL DEFAULT '{}',
  top_freelances              JSONB   NOT NULL DEFAULT '[]',   -- [{id, nom, volume, note}]
  evolution_journaliere       JSONB   NOT NULL DEFAULT '[]',   -- [{date, commandes, volume}]

  -- Export
  pdf_url                     TEXT,
  pdf_generated_le            TIMESTAMPTZ,

  -- Traçabilité
  genere_le                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  genere_par                  TEXT    NOT NULL DEFAULT 'cron',   -- 'cron' ou uuid admin

  UNIQUE (periode_mois, periode_annee)
);

ALTER TABLE rapports_financiers_mensuels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rapports_admin_only" ON rapports_financiers_mensuels USING (fn_is_admin());

-- ════════════════════════════════════════════
-- 7. RPC : créer un rappel (utilisée par Edge Functions)
-- ════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_planifier_rappel(
  p_user_id       UUID,
  p_type          TEXT,
  p_ref_id        UUID,
  p_ref_type      TEXT,
  p_envoyer_le    TIMESTAMPTZ,
  p_canal         TEXT DEFAULT 'in_app',
  p_metadata      JSONB DEFAULT '{}'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO rappels (user_id, type_rappel, reference_id, reference_type, envoyer_le, canal, metadata)
  VALUES (p_user_id, p_type, p_ref_id, p_ref_type, p_envoyer_le, p_canal, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
