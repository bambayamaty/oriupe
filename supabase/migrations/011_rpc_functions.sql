-- ═══════════════════════════════════════════════════════════════════
-- 011_rpc_functions.sql — Fonctions RPC métier
-- Toutes les fonctions SECURITY DEFINER s'exécutent avec les droits
-- de l'owner (pas du user appelant), donc les RLS ne s'appliquent pas
-- en interne → validation manuelle obligatoire dans chaque fonction.
-- ═══════════════════════════════════════════════════════════════════

-- ── fn_create_profile_after_signup ──────────────────────────────────
-- Déclenchée par un trigger Supabase Auth ou appelée après signUp
CREATE OR REPLACE FUNCTION fn_create_profile_after_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  user_role_val user_role;
  account_type_val account_type;
BEGIN
  user_role_val    := COALESCE(NEW.raw_user_meta_data->>'role', 'client')::user_role;
  account_type_val := COALESCE(NEW.raw_user_meta_data->>'account_type', 'individual')::account_type;

  -- Crée le profil de base
  INSERT INTO profiles (
    id, first_name, last_name, email,
    role, account_type, account_status,
    kyc_status, country_code, language, currency
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    user_role_val,
    account_type_val,
    CASE WHEN user_role_val = 'client' THEN 'active' ELSE 'pending_kyc' END,
    'not_submitted',
    NULLIF(NEW.raw_user_meta_data->>'country_code', ''),
    COALESCE(NEW.raw_user_meta_data->>'language', 'fr'),
    COALESCE((NEW.raw_user_meta_data->>'currency')::currency_code, 'XOF')
  ) ON CONFLICT (id) DO NOTHING;

  -- Crée le sous-profil selon le rôle
  IF user_role_val = 'client' THEN
    INSERT INTO client_profiles (profile_id)
    VALUES (NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;

  ELSIF user_role_val = 'freelance' THEN
    INSERT INTO freelance_profiles (
      profile_id, slug, professional_title
    ) VALUES (
      NEW.id,
      LOWER(COALESCE(NEW.raw_user_meta_data->>'first_name','user')) || '-' ||
        LOWER(COALESCE(NEW.raw_user_meta_data->>'last_name','')) || '-' ||
        SUBSTR(NEW.id::TEXT, 1, 8),
      COALESCE(NEW.raw_user_meta_data->>'professional_title', '')
    ) ON CONFLICT DO NOTHING;

    -- Crée un dossier KYC vide
    INSERT INTO kyc_cases (profile_id, status)
    VALUES (NEW.id, 'not_submitted')
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Enregistrement du trigger sur auth.users (via Supabase Dashboard ou CLI)
-- CREATE TRIGGER trg_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION fn_create_profile_after_signup();

-- ── fn_create_order_from_service ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_create_order_from_service(
  p_service_id      UUID,
  p_package_id      UUID,
  p_requirements    TEXT DEFAULT NULL,
  p_extras          JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id UUID := auth.uid();
  v_service    services%ROWTYPE;
  v_pkg        service_packages%ROWTYPE;
  v_freelance  freelance_profiles%ROWTYPE;
  v_total      BIGINT;
  v_days       INT;
  v_commission NUMERIC;
  v_rate       NUMERIC;
  v_order_id   UUID;
  v_escrow_id  UUID;
  v_conv_id    UUID;
  v_ref        TEXT;
  v_code       TEXT;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- Charger le service
  SELECT * INTO v_service FROM services WHERE id = p_service_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;

  -- Charger le package
  SELECT * INTO v_pkg FROM service_packages WHERE id = p_package_id AND service_id = p_service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PACKAGE_NOT_FOUND'; END IF;

  -- Charger le freelance
  SELECT * INTO v_freelance FROM freelance_profiles WHERE id = v_service.freelance_id;

  -- Vérifier que le client ne commande pas son propre service
  IF v_freelance.profile_id = v_client_id THEN
    RAISE EXCEPTION 'CANNOT_ORDER_OWN_SERVICE';
  END IF;

  -- Calcul du montant
  v_total := v_pkg.price_cents;
  v_days  := v_pkg.delivery_days;

  -- Taux de commission selon le plan
  SELECT COALESCE((value->>'free')::NUMERIC, 0.15)
  INTO v_rate
  FROM platform_settings WHERE key = 'commission_rates';

  -- Générer référence et code escrow
  v_ref  := 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 100000)::TEXT, 6, '0');
  v_code := fn_generate_escrow_code();

  -- Créer la commande
  INSERT INTO orders (
    client_id, freelance_id, source,
    service_id, service_package_id,
    ref, title, requirements,
    amount_total_cents, commission_rate, currency,
    delivery_days, revisions_included,
    status, escrow_code,
    deadline
  ) VALUES (
    v_client_id, v_freelance.id, 'service',
    p_service_id, p_package_id,
    v_ref,
    v_service.title || ' — ' || v_pkg.name,
    p_requirements,
    v_total, v_rate, v_service.currency,
    v_days, v_pkg.revisions,
    'pending_payment', v_code,
    NOW() + (v_days || ' days')::INTERVAL
  ) RETURNING id INTO v_order_id;

  -- Créer la transaction escrow
  INSERT INTO escrow_transactions (order_id, status, amount_total_cents)
  VALUES (v_order_id, 'awaiting_payment', v_total)
  RETURNING id INTO v_escrow_id;

  -- Créer la conversation order
  INSERT INTO conversations (type, order_id, created_by)
  VALUES ('order', v_order_id, v_client_id)
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_conv_id;

  IF v_conv_id IS NULL THEN
    SELECT id INTO v_conv_id FROM conversations WHERE order_id = v_order_id;
  END IF;

  -- Ajouter les participants
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES
    (v_conv_id, v_client_id),
    (v_conv_id, v_freelance.profile_id)
  ON CONFLICT DO NOTHING;

  -- Message système de création
  INSERT INTO messages (conversation_id, sender_id, type, body, metadata)
  VALUES (
    v_conv_id, v_client_id, 'system',
    'Commande créée · Ref ' || v_ref || ' · En attente de paiement',
    jsonb_build_object('order_id', v_order_id, 'ref', v_ref, 'status', 'pending_payment')
  );

  -- Notification au freelance
  INSERT INTO notifications (user_id, type, title, body, data, action_url)
  VALUES (
    v_freelance.profile_id,
    'new_order',
    'Nouvelle commande — ' || v_ref,
    'Commande de ' || v_total || ' XOF · Délai ' || v_days || 'j',
    jsonb_build_object('order_id', v_order_id),
    '/src/pages/dashboard/escrow/index.html?order=' || v_order_id
  );

  RETURN jsonb_build_object(
    'order_id',  v_order_id,
    'escrow_id', v_escrow_id,
    'conv_id',   v_conv_id,
    'ref',       v_ref,
    'code',      v_code,
    'amount',    v_total
  );
END;
$$;

-- ── fn_mark_order_paid ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_mark_order_paid(
  p_order_id          UUID,
  p_payment_ref       TEXT,
  p_operator          payment_operator,
  p_provider          payment_provider DEFAULT 'cinetpay'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order     orders%ROWTYPE;
  v_escrow_id UUID;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.status != 'pending_payment' THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', v_order.status;
  END IF;

  -- Mettre à jour la commande
  UPDATE orders
  SET status = 'paid', paid_at = NOW(), started_at = NOW(),
      auto_validate_at = NOW() + INTERVAL '7 days'
  WHERE id = p_order_id;

  -- Mettre à jour l'escrow
  UPDATE escrow_transactions
  SET status = 'funds_secured',
      amount_secured_cents = v_order.amount_total_cents,
      payment_operator = p_operator,
      payment_provider = p_provider,
      payment_ref = p_payment_ref
  WHERE order_id = p_order_id
  RETURNING id INTO v_escrow_id;

  -- Journal escrow
  INSERT INTO escrow_events (escrow_id, event_type, amount_cents, note)
  VALUES (v_escrow_id, 'payment_received', v_order.amount_total_cents, 'Paiement confirmé via ' || p_operator);

  -- Notification au client
  INSERT INTO notifications (user_id, type, title, body, data, action_url)
  VALUES (
    v_order.client_id, 'payment_secured',
    'Paiement sécurisé — ' || v_order.ref,
    'Fonds sécurisés en escrow. Le freelance peut démarrer.',
    jsonb_build_object('order_id', p_order_id),
    '/src/pages/dashboard/escrow/index.html?order=' || p_order_id
  );

  -- Message système
  UPDATE conversations SET last_message_at = NOW()
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'escrow_id', v_escrow_id);
END;
$$;

-- ── fn_mark_delivery_submitted ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_mark_delivery_submitted(
  p_order_id  UUID,
  p_message   TEXT,
  p_files     JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_order orders%ROWTYPE;
  v_del_id UUID;
  v_num INT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  -- Seul le freelance peut livrer
  IF v_order.freelance_id != (SELECT id FROM freelance_profiles WHERE profile_id = v_uid) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF v_order.status NOT IN ('paid','in_progress','revision_requested') THEN
    RAISE EXCEPTION 'INVALID_STATUS_FOR_DELIVERY: %', v_order.status;
  END IF;

  SELECT COALESCE(MAX(delivery_number), 0) + 1 INTO v_num
  FROM order_deliveries WHERE order_id = p_order_id;

  INSERT INTO order_deliveries (order_id, submitted_by, message, files, delivery_number)
  VALUES (p_order_id, v_uid, p_message, p_files, v_num)
  RETURNING id INTO v_del_id;

  UPDATE orders
  SET status = 'delivered', delivered_at = NOW()
  WHERE id = p_order_id;

  UPDATE escrow_transactions SET status = 'delivered'
  WHERE order_id = p_order_id;

  -- Notification client
  INSERT INTO notifications (user_id, type, title, body, data, action_url)
  VALUES (
    v_order.client_id, 'delivery_received',
    'Livraison disponible — ' || v_order.ref,
    'Le freelance a livré. Validez pour libérer les fonds.',
    jsonb_build_object('order_id', p_order_id, 'delivery_id', v_del_id),
    '/src/pages/dashboard/escrow/index.html?order=' || p_order_id
  );

  RETURN jsonb_build_object('delivery_id', v_del_id, 'delivery_number', v_num);
END;
$$;

-- ── fn_validate_delivery_and_release_escrow ──────────────────────────
CREATE OR REPLACE FUNCTION fn_validate_delivery_and_release_escrow(
  p_order_id  UUID,
  p_note      TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_order   orders%ROWTYPE;
  v_escrow  escrow_transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  -- Seul le client peut valider
  IF v_order.client_id != v_uid THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;

  IF v_order.status != 'delivered' THEN
    RAISE EXCEPTION 'ORDER_NOT_DELIVERED: %', v_order.status;
  END IF;

  SELECT * INTO v_escrow FROM escrow_transactions WHERE order_id = p_order_id;

  -- Libération escrow
  UPDATE escrow_transactions
  SET
    status = 'completed',
    amount_released_cents = amount_total_cents,
    released_at = NOW(),
    released_by = v_uid
  WHERE order_id = p_order_id;

  -- Mettre à jour commande
  UPDATE orders SET status = 'completed', completed_at = NOW()
  WHERE id = p_order_id;

  -- Journal escrow
  INSERT INTO escrow_events (escrow_id, event_type, amount_cents, triggered_by, note)
  VALUES (
    v_escrow.id, 'funds_released',
    v_escrow.amount_total_cents, v_uid, p_note
  );

  -- Mettre à jour les stats du freelance
  UPDATE freelance_profiles
  SET
    completed_orders = completed_orders + 1,
    total_revenue_cents = total_revenue_cents + v_order.amount_net_cents,
    pending_payout_cents = pending_payout_cents + v_order.amount_net_cents
  WHERE id = v_order.freelance_id;

  -- Notification freelance
  INSERT INTO notifications (user_id, type, title, body, data, action_url)
  VALUES (
    (SELECT profile_id FROM freelance_profiles WHERE id = v_order.freelance_id),
    'order_completed',
    'Commande validée — ' || v_order.ref,
    'Le client a validé la livraison. Virement en préparation.',
    jsonb_build_object('order_id', p_order_id, 'amount_net', v_order.amount_net_cents),
    '/src/pages/dashboard/freelance/index.html'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'amount_released', v_escrow.amount_total_cents,
    'amount_net', v_order.amount_net_cents
  );
END;
$$;

-- ── fn_request_revision ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_request_revision(
  p_order_id  UUID,
  p_reason    TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_order orders%ROWTYPE;
  v_num   INT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.client_id != v_uid THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  IF v_order.status != 'delivered' THEN RAISE EXCEPTION 'NOT_DELIVERED'; END IF;

  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO v_num
  FROM order_revisions WHERE order_id = p_order_id;

  IF v_num > v_order.revisions_included THEN
    RAISE EXCEPTION 'MAX_REVISIONS_REACHED: %', v_order.revisions_included;
  END IF;

  INSERT INTO order_revisions (order_id, requested_by, reason, revision_number)
  VALUES (p_order_id, v_uid, p_reason, v_num);

  UPDATE orders
  SET status = 'revision_requested', revisions_used = revisions_used + 1
  WHERE id = p_order_id;

  UPDATE escrow_transactions SET status = 'in_progress'
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object('revision_number', v_num, 'revisions_remaining', v_order.revisions_included - v_num);
END;
$$;

-- ── fn_open_dispute ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_open_dispute(
  p_order_id    UUID,
  p_category    dispute_category,
  p_reason      TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_order     orders%ROWTYPE;
  v_disp_id   UUID;
  v_conv_id   UUID;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  -- Seuls client et freelance concernés peuvent ouvrir un litige
  IF v_order.client_id != v_uid AND
     v_order.freelance_id != (SELECT id FROM freelance_profiles WHERE profile_id = v_uid) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF v_order.status NOT IN ('delivered','paid','in_progress','revision_requested') THEN
    RAISE EXCEPTION 'INVALID_STATUS_FOR_DISPUTE: %', v_order.status;
  END IF;

  -- Vérifier qu'il n'y a pas déjà un litige ouvert
  IF EXISTS (SELECT 1 FROM disputes WHERE order_id = p_order_id AND status NOT IN ('closed','resolved')) THEN
    RAISE EXCEPTION 'DISPUTE_ALREADY_OPEN';
  END IF;

  -- Créer la conversation de litige
  INSERT INTO conversations (type, order_id, created_by, title)
  VALUES ('dispute', p_order_id, v_uid, 'Litige — ' || v_order.ref)
  RETURNING id INTO v_conv_id;

  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES
    (v_conv_id, v_order.client_id),
    (v_conv_id, (SELECT profile_id FROM freelance_profiles WHERE id = v_order.freelance_id));

  -- Créer le litige
  INSERT INTO disputes (order_id, opened_by, category, reason, description, conversation_id)
  VALUES (p_order_id, v_uid, p_category, p_reason, p_description, v_conv_id)
  RETURNING id INTO v_disp_id;

  -- Bloquer l'escrow
  UPDATE orders SET status = 'disputed' WHERE id = p_order_id;
  UPDATE escrow_transactions SET status = 'disputed' WHERE order_id = p_order_id;

  -- Notification admin
  INSERT INTO moderation_queue (target_type, target_id, reason, priority)
  VALUES ('user', p_order_id, 'Litige ouvert: ' || p_reason, 8);

  RETURN jsonb_build_object(
    'dispute_id', v_disp_id,
    'conv_id', v_conv_id
  );
END;
$$;

-- ── fn_create_conversation ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_create_conversation(
  p_other_user_id UUID,
  p_initial_message TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_conv_id UUID;
  v_msg_id  UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_uid = p_other_user_id THEN RAISE EXCEPTION 'CANNOT_MESSAGE_SELF'; END IF;

  -- Trouver une conversation directe existante
  SELECT cp1.conversation_id INTO v_conv_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = v_uid
    AND cp2.user_id = p_other_user_id
    AND c.type = 'direct'
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO conversations (type, created_by)
    VALUES ('direct', v_uid)
    RETURNING id INTO v_conv_id;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_uid), (v_conv_id, p_other_user_id);
  END IF;

  -- Envoyer le message initial si fourni
  IF p_initial_message IS NOT NULL AND length(trim(p_initial_message)) > 0 THEN
    INSERT INTO messages (conversation_id, sender_id, type, body)
    VALUES (v_conv_id, v_uid, 'text', p_initial_message)
    RETURNING id INTO v_msg_id;
  END IF;

  RETURN jsonb_build_object('conversation_id', v_conv_id, 'message_id', v_msg_id);
END;
$$;

-- ── fn_send_message ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_send_message(
  p_conversation_id UUID,
  p_body            TEXT,
  p_type            message_type DEFAULT 'text',
  p_reply_to_id     UUID DEFAULT NULL,
  p_attachments     JSONB DEFAULT '[]',
  p_metadata        JSONB DEFAULT '{}'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_msg_id UUID;
BEGIN
  -- Vérifier que l'utilisateur est participant actif
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = v_uid AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'NOT_A_PARTICIPANT';
  END IF;

  INSERT INTO messages (
    conversation_id, sender_id, body, type,
    reply_to_id, attachments, metadata
  ) VALUES (
    p_conversation_id, v_uid, p_body, p_type,
    p_reply_to_id, p_attachments, p_metadata
  ) RETURNING id INTO v_msg_id;

  RETURN jsonb_build_object('message_id', v_msg_id, 'conversation_id', p_conversation_id);
END;
$$;
