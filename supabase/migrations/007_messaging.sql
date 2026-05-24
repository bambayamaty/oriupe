-- ═══════════════════════════════════════════════════════════════════
-- 007_messaging.sql — Messagerie unifiée (remplace conversations + collaboration_messages)
-- Dépend de : 002_profiles.sql, 006_orders_escrow.sql
-- NOTE: Supprime l'ancienne table collaboration_messages si elle existait
-- ═══════════════════════════════════════════════════════════════════

-- Supprimer les anciennes tables si elles existent (migration depuis l'état actuel)
DROP TABLE IF EXISTS collaboration_messages CASCADE;

-- ── conversations ─────────────────────────────────────────────────────
CREATE TABLE conversations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type
  type                conversation_type NOT NULL DEFAULT 'direct',

  -- Liens optionnels selon le type
  order_id            UUID        REFERENCES orders(id),
  dispute_id          UUID,       -- FK ajoutée en 010_disputes.sql

  -- Aperçu
  last_message_preview TEXT       DEFAULT '',
  last_message_at     TIMESTAMPTZ,
  last_sender_id      UUID        REFERENCES profiles(id),

  -- Métadonnées
  title               TEXT,       -- titre pour les conversations support
  is_archived         BOOLEAN     NOT NULL DEFAULT FALSE,

  created_by          UUID        REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte: une seule conversation de type order par commande
  CONSTRAINT uq_conversation_order UNIQUE (order_id)
);

CREATE INDEX idx_conv_type       ON conversations(type);
CREATE INDEX idx_conv_order      ON conversations(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_conv_last_msg   ON conversations(last_message_at DESC NULLS LAST);

-- ── conversation_participants : remplace le tableau jsonb ────────────
-- Normalisation propre = indexable, requêtable, performant
CREATE TABLE conversation_participants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Rôle dans la conversation
  role            TEXT        DEFAULT 'member' CHECK (role IN ('member','admin','support')),

  -- Compteur de non-lus (remplace le jsonb unread_counts)
  unread_count    INT         NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_read_at    TIMESTAMPTZ,

  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at         TIMESTAMPTZ,   -- NULL = participant actif

  UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_cp_user         ON conversation_participants(user_id);
CREATE INDEX idx_cp_conversation ON conversation_participants(conversation_id);
-- Index clé: récupérer toutes les conversations d'un user (critiquement utilisé)
CREATE INDEX idx_cp_user_active  ON conversation_participants(user_id, conversation_id)
  WHERE left_at IS NULL;

-- ── messages : table unique pour tous les types de messages ──────────
CREATE TABLE messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES profiles(id),

  -- Contenu
  body            TEXT,       -- NULL autorisé pour messages type fichier pur
  type            message_type NOT NULL DEFAULT 'text',

  -- Fil de discussion
  reply_to_id     UUID        REFERENCES messages(id),

  -- Pièces jointes (dénormalisé pour performance lecture)
  attachments     JSONB       NOT NULL DEFAULT '[]',

  -- Réactions emoji {emoji: [user_id, ...]}
  reactions       JSONB       NOT NULL DEFAULT '{}',

  -- Métadonnées contextuelles (escrow_card, delivery info, etc.)
  metadata        JSONB       NOT NULL DEFAULT '{}',

  -- État
  is_edited       BOOLEAN     NOT NULL DEFAULT FALSE,
  edited_at       TIMESTAMPTZ,
  is_deleted      BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msg_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_msg_sender       ON messages(sender_id);
CREATE INDEX idx_msg_type         ON messages(type) WHERE type != 'text';

-- ── message_attachments : suivi individuel des fichiers ──────────────
CREATE TABLE message_attachments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  url             TEXT        NOT NULL,
  storage_path    TEXT,
  mime_type       TEXT,
  size_bytes      BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mattach_message ON message_attachments(message_id);

-- ── message_reads : tracking de lecture (optionnel, pour receipts) ───
-- Note: un index partiel évite la surcharge sur les grands volumes
CREATE TABLE message_reads (
  message_id  UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_mreads_user ON message_reads(user_id, message_id);

-- ── Triggers messagerie ──────────────────────────────────────────────

-- Mise à jour last_message sur la conversation
CREATE OR REPLACE FUNCTION fn_update_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_preview = CASE
      WHEN NEW.type = 'text' THEN left(coalesce(NEW.body,''), 80)
      ELSE '[' || NEW.type || ']'
    END,
    last_message_at = NEW.created_at,
    last_sender_id  = NEW.sender_id,
    updated_at      = NOW()
  WHERE id = NEW.conversation_id;

  -- Incrémenter unread_count pour tous les participants sauf l'expéditeur
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    AND left_at IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_message_updates_conversation
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.is_deleted = FALSE)
  EXECUTE FUNCTION fn_update_conversation_on_message();

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Vue pratique: conversations d'un utilisateur avec métadonnées ────
CREATE VIEW v_user_conversations AS
SELECT
  cp.user_id,
  c.id AS conversation_id,
  c.type,
  c.order_id,
  c.last_message_preview,
  c.last_message_at,
  c.last_sender_id,
  c.title,
  cp.unread_count,
  cp.last_read_at,
  cp.role AS participant_role
FROM conversation_participants cp
JOIN conversations c ON c.id = cp.conversation_id
WHERE cp.left_at IS NULL
  AND c.is_archived = FALSE;
