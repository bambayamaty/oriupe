-- ═══════════════════════════════════════════════════════════════════
-- 019_fn_mark_conversation_read.sql
-- Dépend de : 007_messaging.sql, 012_rls_policies.sql
--
-- Problème : markConversationRead() côté client faisait un UPDATE
-- direct sur conversations.unread_counts (JSONB), mais :
--   1. Il n'y a pas de RLS UPDATE policy sur conversations
--   2. Le bon champ est conversation_participants.unread_count (INT)
--
-- Solution : RPC SECURITY DEFINER qui écrit au bon endroit après
-- avoir vérifié que l'appelant est bien participant.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_mark_conversation_read(p_conv_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conv_id
      AND user_id = v_uid
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'NOT_PARTICIPANT';
  END IF;

  UPDATE conversation_participants
  SET unread_count = 0,
      last_read_at = NOW()
  WHERE conversation_id = p_conv_id
    AND user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_mark_conversation_read(UUID) TO authenticated;
