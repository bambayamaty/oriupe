# Spécification Technique — Système Escrow Oriupe

**Version :** 1.0  
**Date :** Janvier 2025  
**Auteur :** Équipe Produit Oriupe  
**Statut :** Prêt pour implémentation

---

## Table des matières

1. [Modèle de données](#1-modèle-de-données)
2. [Statuts Escrow](#2-statuts-escrow)
3. [Endpoints API REST](#3-endpoints-api-rest)
4. [Logique de libération automatique](#4-logique-de-libération-automatique)
5. [Génération du code de transaction](#5-génération-du-code-de-transaction)
6. [Calcul des commissions](#6-calcul-des-commissions)
7. [Intégrations Mobile Money](#7-intégrations-mobile-money)
8. [Règles de sécurité Supabase RLS](#8-règles-de-sécurité-supabase-rls)

---

## 1. Modèle de données

Toutes les tables utilisent Supabase (PostgreSQL). L'extension `uuid-ossp` doit être activée. Le fuseau horaire serveur est réglé sur `UTC`.

### 1.1 Table `orders`

Table principale représentant chaque commande et son espace escrow associé.

```sql
CREATE TYPE order_status AS ENUM (
  'AWAITING_PAYMENT',
  'FUNDS_SECURED',
  'IN_PROGRESS',
  'DELIVERED',
  'VALIDATED',
  'TRANSFERRING',
  'COMPLETED',
  'DISPUTED',
  'CANCELLED',
  'REFUNDED'
);

CREATE TABLE orders (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_code       TEXT          NOT NULL UNIQUE,
  client_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  freelance_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  service_id        UUID          NOT NULL REFERENCES services(id) ON DELETE RESTRICT,

  -- Montants (en FCFA, entiers)
  amount_total      INTEGER       NOT NULL CHECK (amount_total > 0),
  commission_rate   NUMERIC(5,4)  NOT NULL DEFAULT 0.15 CHECK (commission_rate BETWEEN 0 AND 1),
  commission_amount INTEGER       GENERATED ALWAYS AS (ROUND(amount_total * commission_rate)) STORED,
  amount_net        INTEGER       GENERATED ALWAYS AS (amount_total - ROUND(amount_total * commission_rate)) STORED,

  -- Statut et paiement
  status            order_status  NOT NULL DEFAULT 'AWAITING_PAYMENT',
  payment_method    TEXT          CHECK (payment_method IN ('ORANGE_MONEY', 'MTN_MOMO', 'WAVE', 'MOOV_MONEY', 'VISA', 'MASTERCARD')),
  payment_phone     TEXT,

  -- Métadonnées géographiques
  country_code      CHAR(2)       NOT NULL DEFAULT 'CI',

  -- Timestamps clés (NULL = étape non atteinte)
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  paid_at           TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  validated_at      TIMESTAMPTZ,
  transferred_at    TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,

  -- Délai contractuel
  deadline          TIMESTAMPTZ   NOT NULL,

  -- Auto-validation (calculé à la livraison : delivered_at + 5 jours)
  auto_validate_at  TIMESTAMPTZ,

  -- Révisions
  revision_limit    SMALLINT      NOT NULL DEFAULT 3,
  revision_count    SMALLINT      NOT NULL DEFAULT 0 CHECK (revision_count <= revision_limit),

  -- Référence paiement externe (CinetPay/FedaPay transaction ID)
  payment_ref_ext   TEXT,

  CONSTRAINT fk_client_ne_freelance CHECK (client_id != freelance_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_orders_client_id      ON orders(client_id);
CREATE INDEX idx_orders_freelance_id   ON orders(freelance_id);
CREATE INDEX idx_orders_status         ON orders(status);
CREATE INDEX idx_orders_escrow_code    ON orders(escrow_code);
CREATE INDEX idx_orders_auto_validate  ON orders(auto_validate_at) WHERE auto_validate_at IS NOT NULL;
```

### 1.2 Table `escrow_transactions`

Enregistre chaque mouvement de fonds associé à une commande (entrée du paiement client, sortie vers le freelance, remboursement, etc.).

```sql
CREATE TYPE transaction_direction AS ENUM ('INBOUND', 'OUTBOUND', 'REFUND');
CREATE TYPE transaction_status    AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED');

CREATE TABLE escrow_transactions (
  id                    UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id              UUID                    NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,

  amount                INTEGER                 NOT NULL CHECK (amount > 0),
  direction             transaction_direction   NOT NULL,
  status                transaction_status      NOT NULL DEFAULT 'PENDING',

  -- Opérateur Mobile Money
  mobile_money_provider TEXT                    CHECK (mobile_money_provider IN (
                                                  'ORANGE_MONEY', 'MTN_MOMO', 'WAVE',
                                                  'MOOV_MONEY', 'FLOOZ', 'AIRTEL_MONEY'
                                                )),
  -- Numéro de téléphone destinataire/émetteur (format E.164 : +225XXXXXXXXXX)
  phone_number          TEXT,

  -- Référence retournée par l'opérateur ou le PSP (CinetPay, FedaPay)
  reference_ext         TEXT,

  -- Identifiant interne de la transaction CinetPay/FedaPay
  psp_transaction_id    TEXT,

  -- Horodatages
  created_at            TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  processed_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,

  -- Métadonnées brutes du webhook (stockage JSON pour audit)
  webhook_payload       JSONB,

  -- Message d'erreur en cas d'échec
  failure_reason        TEXT
);

CREATE INDEX idx_escrow_tx_order_id ON escrow_transactions(order_id);
CREATE INDEX idx_escrow_tx_status   ON escrow_transactions(status);
CREATE INDEX idx_escrow_tx_ref_ext  ON escrow_transactions(reference_ext) WHERE reference_ext IS NOT NULL;
```

### 1.3 Table `disputes`

Gère les litiges ouverts par le client ou le freelance sur une commande.

```sql
CREATE TYPE dispute_status   AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_CLIENT', 'RESOLVED_FREELANCE', 'CLOSED');
CREATE TYPE dispute_decision AS ENUM ('REFUND_CLIENT', 'RELEASE_FREELANCE', 'PARTIAL_REFUND', 'CANCELLED');

CREATE TABLE disputes (
  id            UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID             NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  opened_by     UUID             NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Motif déclaré
  reason        TEXT             NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 2000),
  category      TEXT             NOT NULL DEFAULT 'OTHER'
                                 CHECK (category IN (
                                   'NOT_DELIVERED', 'QUALITY_ISSUE', 'WRONG_SERVICE',
                                   'COMMUNICATION_ISSUE', 'FRAUD_SUSPICION', 'OTHER'
                                 )),

  -- Preuves : tableau d'URLs Supabase Storage (max 10 fichiers)
  evidence_urls TEXT[]           NOT NULL DEFAULT '{}' CHECK (array_length(evidence_urls, 1) <= 10),

  status        dispute_status   NOT NULL DEFAULT 'OPEN',

  -- Décision finale (NULL tant que non résolu)
  decision      dispute_decision,
  -- Montant remboursé au client si PARTIAL_REFUND (en FCFA)
  refund_amount INTEGER          CHECK (refund_amount IS NULL OR refund_amount > 0),

  -- Timestamps
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  decided_at    TIMESTAMPTZ,
  decided_by    UUID             REFERENCES auth.users(id),

  -- Un seul litige actif par commande à la fois
  CONSTRAINT uq_dispute_order UNIQUE (order_id)
);

CREATE INDEX idx_disputes_order_id  ON disputes(order_id);
CREATE INDEX idx_disputes_status    ON disputes(status);
CREATE INDEX idx_disputes_opened_by ON disputes(opened_by);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 1.4 Table `collaboration_messages`

Messagerie sécurisée et horodatée entre client et freelance, rattachée à une commande.

```sql
CREATE TABLE collaboration_messages (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Contenu du message (max 2000 caractères)
  body         TEXT          NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),

  -- Pièces jointes : tableau d'objets JSON {url, filename, size_bytes, mime_type}
  attachments  JSONB[]       NOT NULL DEFAULT '{}' CHECK (array_length(attachments, 1) <= 5),

  -- Horodatages
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  read_at      TIMESTAMPTZ,

  -- Si le message est une réponse à un autre message
  reply_to_id  UUID          REFERENCES collaboration_messages(id) ON DELETE SET NULL,

  -- Type de message pour les messages systèmes automatiques (notifications escrow)
  message_type TEXT          NOT NULL DEFAULT 'USER'
               CHECK (message_type IN ('USER', 'SYSTEM_ESCROW', 'SYSTEM_DELIVERY', 'SYSTEM_VALIDATION'))
);

CREATE INDEX idx_collab_msg_order_id   ON collaboration_messages(order_id);
CREATE INDEX idx_collab_msg_sender_id  ON collaboration_messages(sender_id);
CREATE INDEX idx_collab_msg_created_at ON collaboration_messages(order_id, created_at);
```

### 1.5 Table `order_files`

Gère les fichiers déposés dans l'espace de collaboration d'une commande (brief, livrables, révisions).

```sql
CREATE TYPE file_category AS ENUM ('BRIEF', 'DELIVERABLE', 'REVISION', 'REFERENCE', 'OTHER');

CREATE TABLE order_files (
  id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  uploader_id    UUID           NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  filename       TEXT           NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 255),
  -- Chemin dans Supabase Storage : "orders/{order_id}/{uuid}/{filename}"
  storage_path   TEXT           NOT NULL,
  size_bytes     BIGINT         NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 52428800), -- max 50 Mo
  mime_type      TEXT           NOT NULL,
  category       file_category  NOT NULL DEFAULT 'OTHER',

  uploaded_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  -- Soft delete (ne pas effacer les livrables pour audit)
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID           REFERENCES auth.users(id)
);

CREATE INDEX idx_order_files_order_id ON order_files(order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_order_files_uploader ON order_files(uploader_id);
```

---

## 2. Statuts Escrow

### Diagramme d'états

```
AWAITING_PAYMENT
      │
      │  Client paie via Mobile Money (webhook PSP reçu)
      ▼
FUNDS_SECURED
      │
      │  Freelance accepte et démarre les travaux
      ▼
IN_PROGRESS ◄──────────────────────────────────────┐
      │                                             │ Révision demandée par client
      │  Freelance marque "livré"                   │
      ▼                                             │
DELIVERED ─────────────────────────────────────────┘
      │
      │  Client valide (manuel) OU auto-validation (J+5)
      ▼
VALIDATED
      │
      │  Déclenchement du virement vers le freelance
      ▼
TRANSFERRING
      │
      │  Webhook PSP confirme le virement
      ▼
COMPLETED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISPUTED  ← peut être atteint depuis : IN_PROGRESS, DELIVERED, VALIDATED
           → résolution : COMPLETED (libéré freelance) ou REFUNDED (remboursé client)

CANCELLED ← depuis : AWAITING_PAYMENT (24h sans paiement) ou FUNDS_SECURED (avant démarrage)
REFUNDED  ← depuis : DISPUTED (décision en faveur du client) ou CANCELLED
```

### Tableau des transitions autorisées

| Statut actuel      | Transition vers          | Déclencheur                                          | Acteur           |
|--------------------|--------------------------|------------------------------------------------------|------------------|
| `AWAITING_PAYMENT` | `FUNDS_SECURED`          | Webhook PSP : paiement confirmé                      | Système          |
| `AWAITING_PAYMENT` | `CANCELLED`              | 24h écoulées sans paiement (cron job)                | Système          |
| `FUNDS_SECURED`    | `IN_PROGRESS`            | Freelance clique "Démarrer les travaux"              | Freelance        |
| `IN_PROGRESS`      | `DELIVERED`              | Freelance clique "Marquer comme livré"               | Freelance        |
| `IN_PROGRESS`      | `DISPUTED`               | Client ou Freelance ouvre un litige                  | Client/Freelance |
| `DELIVERED`        | `VALIDATED`              | Client valide OU auto-validation J+5                 | Client/Système   |
| `DELIVERED`        | `IN_PROGRESS`            | Client demande une révision (si révisions restantes) | Client           |
| `DELIVERED`        | `DISPUTED`               | Client ouvre un litige                               | Client           |
| `VALIDATED`        | `TRANSFERRING`           | Déclenchement automatique après validation           | Système          |
| `TRANSFERRING`     | `COMPLETED`              | Webhook PSP : virement confirmé                      | Système          |
| `DISPUTED`         | `COMPLETED`              | Admin décide en faveur du freelance                  | Admin            |
| `DISPUTED`         | `REFUNDED`               | Admin décide en faveur du client                     | Admin            |

---

## 3. Endpoints API REST

Base URL : `/api/v1`  
Authentification : Bearer token JWT Supabase (header `Authorization: Bearer <token>`)  
Format : JSON

### 3.1 `POST /orders/{id}/pay`

Initie le paiement escrow par le client via Mobile Money.

**Autorisation :** client de la commande uniquement

**Corps de la requête :**
```json
{
  "payment_method": "ORANGE_MONEY",
  "phone_number": "+22507000000",
  "return_url": "https://oriupe.com/dashboard/client?order=ORU-2025-0892"
}
```

**Réponse 200 :**
```json
{
  "status": "PENDING",
  "payment_url": "https://secure.cinetpay.com/payment?token=...",
  "transaction_id": "uuid-escrow-transaction",
  "expires_at": "2025-01-25T14:32:00Z"
}
```

**Réponse 409 :** Commande déjà payée ou annulée  
**Réponse 422 :** Numéro de téléphone invalide ou opérateur non supporté dans le pays

**Logique serveur :**
1. Vérifier que `order.status == 'AWAITING_PAYMENT'`
2. Vérifier que `client_id == auth.uid()`
3. Créer une `escrow_transaction` avec `status = 'PENDING'` et `direction = 'INBOUND'`
4. Appeler l'API CinetPay/FedaPay pour générer le lien de paiement
5. Stocker le `psp_transaction_id` dans `escrow_transactions`
6. Retourner le lien de paiement

---

### 3.2 `POST /orders/{id}/mark-delivered`

Le freelance marque la commande comme livrée.

**Autorisation :** freelance de la commande uniquement

**Corps de la requête :**
```json
{
  "delivery_note": "Voici les 3 fichiers finaux : logo vectoriel, charte graphique PDF, et les exports PNG. Révision incluse.",
  "file_ids": ["uuid-file-1", "uuid-file-2", "uuid-file-3"]
}
```

**Réponse 200 :**
```json
{
  "order_id": "uuid-order",
  "status": "DELIVERED",
  "delivered_at": "2025-01-28T11:34:00Z",
  "auto_validate_at": "2025-02-02T11:34:00Z",
  "client_notified": true
}
```

**Réponse 409 :** Statut incompatible (pas `IN_PROGRESS`)  
**Réponse 422 :** Aucun fichier livrable déposé

**Logique serveur :**
1. Vérifier que `order.status == 'IN_PROGRESS'`
2. Vérifier que `freelance_id == auth.uid()`
3. Vérifier qu'au moins un `order_file` avec `category = 'DELIVERABLE'` existe pour cette commande
4. Mettre à jour `orders` : `status = 'DELIVERED'`, `delivered_at = NOW()`, `auto_validate_at = NOW() + INTERVAL '5 days'`
5. Créer un message système `collaboration_messages` : `message_type = 'SYSTEM_DELIVERY'`
6. Envoyer une notification push + email au client
7. Planifier le job d'auto-validation (via `pg_cron` ou Edge Function schedulée)

---

### 3.3 `POST /orders/{id}/validate`

Le client valide la livraison et déclenche le virement vers le freelance.

**Autorisation :** client de la commande uniquement

**Corps de la requête :**
```json
{
  "rating": 5,
  "review": "Excellent travail, logo vraiment professionnel et livré dans les délais.",
  "tip_amount": 0
}
```

**Réponse 200 :**
```json
{
  "order_id": "uuid-order",
  "status": "VALIDATED",
  "validated_at": "2025-01-30T09:15:00Z",
  "transfer_initiated": true,
  "amount_net": 57200,
  "freelance_notified": true
}
```

**Réponse 409 :** Statut incompatible (pas `DELIVERED`)

**Logique serveur :**
1. Vérifier que `order.status == 'DELIVERED'`
2. Vérifier que `client_id == auth.uid()`
3. Mettre à jour `orders` : `status = 'VALIDATED'`, `validated_at = NOW()`
4. Annuler le job d'auto-validation si programmé
5. Créer un message système `message_type = 'SYSTEM_VALIDATION'`
6. Enregistrer la note dans la table `reviews` (voir note ci-dessous)
7. Déclencher immédiatement `POST /orders/{id}/initiate-transfer` (appel interne)

---

### 3.4 `POST /orders/{id}/dispute`

Ouvre un litige sur une commande active.

**Autorisation :** client ou freelance de la commande

**Corps de la requête :**
```json
{
  "reason": "Le freelance n'a pas livré les fichiers sources Illustrator comme prévu dans le brief.",
  "category": "NOT_DELIVERED",
  "evidence_urls": [
    "https://storage.oriupe.com/disputes/uuid/screenshot1.png",
    "https://storage.oriupe.com/disputes/uuid/brief_extract.pdf"
  ]
}
```

**Réponse 201 :**
```json
{
  "dispute_id": "uuid-dispute",
  "order_id": "uuid-order",
  "status": "OPEN",
  "order_status_updated_to": "DISPUTED",
  "created_at": "2025-01-29T16:22:00Z",
  "admin_notified": true,
  "estimated_resolution": "2025-01-31T16:22:00Z"
}
```

**Réponse 409 :** Litige déjà ouvert sur cette commande  
**Réponse 422 :** Commande dans un statut non disputable (COMPLETED, CANCELLED, REFUNDED)

---

### 3.5 `GET /orders/{id}/escrow`

Récupère le statut escrow complet d'une commande.

**Autorisation :** client ou freelance de la commande

**Réponse 200 :**
```json
{
  "order_id": "uuid-order",
  "escrow_code": "ORU-ESC-2025-CI-00892-KA",
  "status": "IN_PROGRESS",
  "amount_total": 65000,
  "commission_rate": 0.15,
  "commission_amount": 9750,
  "amount_net": 55250,
  "payment_method": "ORANGE_MONEY",
  "paid_at": "2025-01-24T14:32:00Z",
  "delivered_at": null,
  "auto_validate_at": null,
  "deadline": "2025-01-31T00:00:00Z",
  "timeline": [
    { "step": "PAYMENT",    "status": "done",    "at": "2025-01-24T14:32:00Z" },
    { "step": "STARTED",    "status": "done",    "at": "2025-01-24T16:15:00Z" },
    { "step": "DELIVERY",   "status": "active",  "at": null },
    { "step": "VALIDATION", "status": "pending", "at": null },
    { "step": "TRANSFER",   "status": "pending", "at": null }
  ],
  "dispute": null
}
```

---

### 3.6 `POST /orders/{id}/messages`

Envoie un message dans l'espace de collaboration sécurisé.

**Autorisation :** client ou freelance de la commande

**Corps de la requête :**
```json
{
  "body": "J'ai regardé la version terracotta, c'est exactement ce qu'il faut !",
  "attachments": [],
  "reply_to_id": null
}
```

**Réponse 201 :**
```json
{
  "message_id": "uuid-message",
  "order_id": "uuid-order",
  "sender_id": "uuid-sender",
  "body": "J'ai regardé la version terracotta, c'est exactement ce qu'il faut !",
  "attachments": [],
  "created_at": "2025-01-29T14:07:00Z",
  "read_at": null
}
```

**Réponse 403 :** Commande terminée ou annulée (messagerie archivée)  
**Réponse 422 :** Corps du message vide ou dépassant 2000 caractères

---

### 3.7 `GET /orders/{id}/messages`

Récupère la liste des messages de la commande (pagination curseur).

**Autorisation :** client ou freelance de la commande

**Query params :**
- `limit` (défaut : 50, max : 100)
- `before` : UUID du message (pagination, messages plus anciens)
- `after` : UUID du message (pagination, messages plus récents)

**Réponse 200 :**
```json
{
  "messages": [
    {
      "id": "uuid-message",
      "order_id": "uuid-order",
      "sender_id": "uuid-sender",
      "sender": {
        "id": "uuid-sender",
        "display_name": "Koffi Amani",
        "role": "client",
        "avatar_url": "https://storage.oriupe.com/avatars/kd.jpg"
      },
      "body": "J'adore la direction n°2 !",
      "attachments": [],
      "message_type": "USER",
      "created_at": "2025-01-28T14:07:00Z",
      "read_at": "2025-01-28T14:12:00Z",
      "reply_to_id": null
    }
  ],
  "has_more": true,
  "next_cursor": "uuid-oldest-message-in-page"
}
```

---

## 4. Logique de libération automatique

### 4.1 Auto-validation J+5

Si le client ne valide pas la livraison dans les 5 jours suivant le marquage "livré", Oriupe procède à une validation automatique.

**Implémentation recommandée : `pg_cron` + Supabase Edge Function**

```sql
-- Activer pg_cron sur le projet Supabase
-- Créer un job qui s'exécute toutes les 15 minutes
SELECT cron.schedule(
  'auto-validate-delivered-orders',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/process-auto-validations',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

**Edge Function `process-auto-validations` :**

```typescript
// supabase/functions/process-auto-validations/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Trouver toutes les commandes DELIVERED dont auto_validate_at est dépassé
  const { data: ordersToValidate } = await supabase
    .from('orders')
    .select('id, client_id, freelance_id, amount_net')
    .eq('status', 'DELIVERED')
    .lte('auto_validate_at', new Date().toISOString())
    .is('validated_at', null)

  for (const order of (ordersToValidate ?? [])) {
    // Mettre à jour le statut
    await supabase
      .from('orders')
      .update({
        status: 'VALIDATED',
        validated_at: new Date().toISOString()
      })
      .eq('id', order.id)

    // Créer un message système
    await supabase.from('collaboration_messages').insert({
      order_id: order.id,
      sender_id: order.client_id, // attribué au client par convention
      body: 'Validation automatique effectuée par Oriupe (5 jours sans réponse du client).',
      message_type: 'SYSTEM_VALIDATION'
    })

    // Déclencher le virement
    await initiateTransfer(order.id, order.amount_net, order.freelance_id)
  }

  return new Response(JSON.stringify({ processed: ordersToValidate?.length ?? 0 }))
})
```

---

### 4.2 Annulation automatique AWAITING_PAYMENT (24h)

```sql
SELECT cron.schedule(
  'cancel-unpaid-orders',
  '0 * * * *', -- toutes les heures
  $$
    UPDATE orders
    SET status = 'CANCELLED', cancelled_at = NOW()
    WHERE status = 'AWAITING_PAYMENT'
      AND created_at < NOW() - INTERVAL '24 hours';
  $$
);
```

---

### 4.3 Flux webhook Mobile Money

Lors de la réception d'un webhook du PSP (CinetPay ou FedaPay) :

```
PSP → POST /webhooks/cinetpay  (ou /webhooks/fedapay)
        │
        ├─ Vérifier la signature HMAC-SHA256 (voir §7)
        │
        ├─ Retrouver la escrow_transaction par psp_transaction_id
        │
        ├─ Si payment_status == 'ACCEPTED' :
        │      UPDATE escrow_transactions SET status = 'COMPLETED', processed_at = NOW()
        │      UPDATE orders SET status = 'FUNDS_SECURED', paid_at = NOW()
        │      → Notifier client + freelance
        │
        └─ Si payment_status == 'REFUSED' ou 'CANCELLED' :
               UPDATE escrow_transactions SET status = 'FAILED', failed_at = NOW()
               UPDATE orders SET status = 'AWAITING_PAYMENT'
               → Notifier client (invitation à réessayer)
```

---

## 5. Génération du code de transaction

### Format

```
ORU-ESC-{YYYY}-{CC}-{NNNNN}-{XX}
```

| Segment | Description | Exemple |
|---------|-------------|---------|
| `ORU`   | Préfixe Oriupe (fixe) | `ORU` |
| `ESC`   | Type : Escrow (fixe) | `ESC` |
| `YYYY`  | Année de la commande (4 chiffres) | `2025` |
| `CC`    | Code pays ISO 3166-1 alpha-2 (2 lettres, majuscules) | `CI`, `SN`, `CM`, `BJ` |
| `NNNNN` | Numéro séquentiel sur 5 chiffres, remis à zéro chaque année par pays | `00892` |
| `XX`    | Initiales du freelance (2 lettres, majuscules) | `KA` pour Kofi Asante |

### Implémentation SQL (fonction PostgreSQL)

```sql
CREATE OR REPLACE FUNCTION generate_escrow_code(
  p_country_code  CHAR(2),
  p_freelance_name TEXT
) RETURNS TEXT AS $$
DECLARE
  v_year      TEXT := TO_CHAR(NOW(), 'YYYY');
  v_seq       INTEGER;
  v_initials  TEXT;
  v_code      TEXT;
BEGIN
  -- Numéro séquentiel par année et par pays
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(escrow_code, '-', 5) AS INTEGER)
  ), 0) + 1
  INTO v_seq
  FROM orders
  WHERE escrow_code LIKE 'ORU-ESC-' || v_year || '-' || UPPER(p_country_code) || '-%';

  -- Initiales : première lettre de chaque mot (max 2 mots)
  SELECT UPPER(
    SUBSTRING(SPLIT_PART(p_freelance_name, ' ', 1), 1, 1) ||
    COALESCE(SUBSTRING(SPLIT_PART(p_freelance_name, ' ', 2), 1, 1), 'X')
  ) INTO v_initials;

  -- Assemblage
  v_code := 'ORU-ESC-' || v_year || '-' || UPPER(p_country_code) || '-' ||
            LPAD(v_seq::TEXT, 5, '0') || '-' || v_initials;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;
```

> **Note :** Pour éviter les race conditions lors de la génération du numéro séquentiel, utiliser `SELECT ... FOR UPDATE` ou une séquence PostgreSQL dédiée par pays/année (ex. : `seq_escrow_2025_ci`).

---

## 6. Calcul des commissions

### Règles de calcul

```
amount_total      = montant payé par le client (FCFA, entier)
commission_rate   = snapshot du plan freelance (15%, 10% ou 7%)
commission_amount = ROUND(amount_total × commission_rate)
amount_net        = amount_total − commission_amount
```

Ces valeurs sont calculées automatiquement par PostgreSQL via des colonnes `GENERATED ALWAYS AS` (voir §1.1), ce qui garantit leur cohérence et évite tout calcul côté application.

### Exemples

| Montant total | Commission 15% | Net freelance |
|---------------|----------------|---------------|
| 10 000 FCFA   | 1 500 FCFA     | 8 500 FCFA    |
| 25 000 FCFA   | 3 750 FCFA     | 21 250 FCFA   |
| 65 000 FCFA   | 9 750 FCFA     | 55 250 FCFA   |
| 150 000 FCFA  | 22 500 FCFA    | 127 500 FCFA  |
| 500 000 FCFA  | 75 000 FCFA    | 425 000 FCFA  |

### Taux variables selon plan freelance

| Niveau         | Taux commission | Condition                              |
|----------------|-----------------|----------------------------------------|
| Gratuit        | 15%             | Plan par défaut                        |
| Pro            | 10%             | Abonnement Pro actif                   |
| Business       | 7%              | Abonnement Business actif              |

Stocker `commission_rate` directement dans la commande (snapshot au moment de la création) pour qu'une évolution du taux n'affecte pas les commandes en cours.

---

## 7. Intégrations Mobile Money

### 7.1 CinetPay (recommandé pour CI, SN, CM, BF)

CinetPay est le PSP principal recommandé pour Oriupe. Il couvre Orange Money, MTN MoMo, Wave, Moov Money et Flooz en Côte d'Ivoire, Sénégal, Cameroun, Burkina Faso et Mali.

**Documentation :** https://docs.cinetpay.com

**Flux de paiement entrant (client → escrow) :**
 l
```typescript
// Étape 1 : Initialiser le paiement
const initPayload = {
  apikey: process.env.CINETPAY_API_KEY,
  site_id: process.env.CINETPAY_SITE_ID,
  transaction_id: escrowTransaction.id, // UUID Oriupe
  amount: order.amount_total,
  currency: 'XOF', // Franc CFA BCEAO
  description: `Escrow Oriupe - Commande ${order.escrow_code}`,
  return_url: `${ORIUPE_BASE_URL}/dashboard/client`,
  notify_url: `${ORIUPE_API_URL}/webhooks/cinetpay`,
  customer_name: client.display_name,
  customer_surname: '',
  customer_email: client.email,
  customer_phone_number: order.payment_phone, // format : +22507XXXXXXXX
  customer_address: '',
  customer_city: '',
  customer_country: order.country_code,
  customer_state: '',
  customer_zip_code: ''
}

const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(initPayload)
})
// response.data.payment_url → rediriger le client
```

**Webhook entrant (réception de la confirmation) :**

```typescript
// POST /webhooks/cinetpay
export async function handleCinetpayWebhook(req: Request) {
  const body = await req.json()

  // 1. Vérifier la signature
  const expectedSig = crypto.createHmac('sha256', process.env.CINETPAY_SECRET_KEY!)
    .update(body.cpm_site_id + body.cpm_trans_id + body.cpm_trans_date + body.cpm_amount + body.cpm_currency)
    .digest('hex')

  if (body.cpm_custom !== expectedSig) {
    return new Response('Invalid signature', { status: 401 })
  }

  // 2. Retrouver la transaction par psp_transaction_id
  const { data: tx } = await supabase
    .from('escrow_transactions')
    .select('*, orders(*)')
    .eq('id', body.cpm_trans_id) // UUID Oriupe stocké comme transaction_id CinetPay
    .single()

  if (!tx) return new Response('Transaction not found', { status: 404 })

  // 3. Mettre à jour selon le statut
  if (body.cpm_result === '00') { // '00' = succès CinetPay
    await supabase.from('escrow_transactions').update({
      status: 'COMPLETED',
      reference_ext: body.cpm_payid,
      processed_at: new Date().toISOString(),
      webhook_payload: body
    }).eq('id', tx.id)

    await supabase.from('orders').update({
      status: 'FUNDS_SECURED',
      paid_at: new Date().toISOString(),
      payment_ref_ext: body.cpm_payid
    }).eq('id', tx.order_id)

  } else {
    await supabase.from('escrow_transactions').update({
      status: 'FAILED',
      failed_at: new Date().toISOString(),
      failure_reason: `CinetPay code: ${body.cpm_result}`,
      webhook_payload: body
    }).eq('id', tx.id)
  }

  return new Response('OK', { status: 200 })
}
```

---

### 7.2 FedaPay (Bénin, Togo, Niger)

FedaPay est recommandé pour les marchés UEMOA non couverts efficacement par CinetPay, notamment le Bénin et le Togo.

**Documentation :** https://docs.fedapay.com

**Initialisation :**

```typescript
import FedaPay from 'fedapay'

FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY!)
FedaPay.setEnvironment('live') // 'sandbox' pour les tests

const transaction = await FedaPay.Transaction.create({
  description: `Escrow Oriupe - ${order.escrow_code}`,
  amount: order.amount_total,
  currency: { iso: 'XOF' },
  callback_url: `${ORIUPE_API_URL}/webhooks/fedapay`,
  customer: {
    firstname: client.first_name,
    lastname: client.last_name,
    email: client.email,
    phone_number: { number: order.payment_phone, country: order.country_code }
  }
})

const token = await transaction.generateToken()
// token.url → rediriger le client
```

---

### 7.3 Flux de virement sortant (escrow → freelance)

Une fois la commande validée, Oriupe déclenche un virement Mobile Money vers le freelance.

```typescript
// Pour CinetPay (disbursement)
async function initiateTransfer(orderId: string, amount: number, freelanceId: string) {
  const { data: freelance } = await supabase
    .from('profiles')
    .select('payout_phone, payout_provider, country_code')
    .eq('id', freelanceId)
    .single()

  // Créer la transaction sortante
  const { data: tx } = await supabase.from('escrow_transactions').insert({
    order_id: orderId,
    amount,
    direction: 'OUTBOUND',
    status: 'PROCESSING',
    mobile_money_provider: freelance.payout_provider,
    phone_number: freelance.payout_phone
  }).select().single()

  // Appeler l'API de virement CinetPay
  const response = await fetch('https://api-transfer.cinetpay.com/v1/transfer/money/send/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CINETPAY_TRANSFER_TOKEN}`
    },
    body: JSON.stringify({
      data: [{
        prefix: freelance.country_code === 'CI' ? '225' : '221',
        phone: freelance.payout_phone.replace(/^\+\d{3}/, ''), // sans indicatif
        amount,
        notify_url: `${ORIUPE_API_URL}/webhooks/cinetpay-transfer`,
        client_transaction_id: tx.id
      }],
      lang: 'fr',
      wallet: 'MOBILE_MONEY'
    })
  })

  await supabase.from('orders').update({ status: 'TRANSFERRING' }).eq('id', orderId)
}
```

---

## 8. Règles de sécurité Supabase RLS

Activer RLS sur toutes les tables. Les politiques suivantes définissent les accès minimaux nécessaires.

### 8.1 Table `orders`

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Lecture : accessible par le client OU le freelance de la commande
CREATE POLICY "orders_select_participant" ON orders
  FOR SELECT USING (
    auth.uid() = client_id OR auth.uid() = freelance_id
  );

-- Insertion : uniquement via fonction serveur (service_role), pas directement par les utilisateurs
CREATE POLICY "orders_insert_service_only" ON orders
  FOR INSERT WITH CHECK (false); -- bloqué pour tous les utilisateurs

-- Mise à jour : uniquement via fonctions serveur (service_role)
CREATE POLICY "orders_update_service_only" ON orders
  FOR UPDATE USING (false);

-- Admin Oriupe : accès complet (rôle personnalisé 'oriupe_admin')
CREATE POLICY "orders_admin_all" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'oriupe_admin'
    )
  );
```

### 8.2 Table `collaboration_messages`

```sql
ALTER TABLE collaboration_messages ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement les participants de la commande associée
CREATE POLICY "messages_select_participant" ON collaboration_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = collaboration_messages.order_id
        AND (orders.client_id = auth.uid() OR orders.freelance_id = auth.uid())
    )
  );

-- Insertion : uniquement par les participants
CREATE POLICY "messages_insert_participant" ON collaboration_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = collaboration_messages.order_id
        AND (orders.client_id = auth.uid() OR orders.freelance_id = auth.uid())
        AND orders.status NOT IN ('COMPLETED', 'CANCELLED', 'REFUNDED')
    )
  );

-- Mise à jour : uniquement l'auteur peut marquer comme lu (read_at)
CREATE POLICY "messages_update_read_at" ON collaboration_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = collaboration_messages.order_id
        AND (orders.client_id = auth.uid() OR orders.freelance_id = auth.uid())
    )
  )
  WITH CHECK (
    -- Seul read_at peut être modifié par les utilisateurs normaux
    sender_id = collaboration_messages.sender_id AND
    body = collaboration_messages.body
  );
```

### 8.3 Table `escrow_transactions`

```sql
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Lecture : participants de la commande OU admin
CREATE POLICY "escrow_tx_select_participant_or_admin" ON escrow_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = escrow_transactions.order_id
        AND (orders.client_id = auth.uid() OR orders.freelance_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'oriupe_admin'
    )
  );

-- Insertion / Mise à jour : service_role uniquement (webhooks PSP, fonctions serveur)
CREATE POLICY "escrow_tx_write_service_only" ON escrow_transactions
  FOR INSERT WITH CHECK (false);

CREATE POLICY "escrow_tx_update_service_only" ON escrow_transactions
  FOR UPDATE USING (false);
```

### 8.4 Table `order_files`

```sql
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;

-- Lecture : participants de la commande
CREATE POLICY "order_files_select_participant" ON order_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_files.order_id
        AND (orders.client_id = auth.uid() OR orders.freelance_id = auth.uid())
    )
    AND deleted_at IS NULL
  );

-- Insertion : participants de la commande (commande encore active)
CREATE POLICY "order_files_insert_participant" ON order_files
  FOR INSERT WITH CHECK (
    uploader_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_files.order_id
        AND (orders.client_id = auth.uid() OR orders.freelance_id = auth.uid())
        AND orders.status IN ('FUNDS_SECURED', 'IN_PROGRESS', 'DELIVERED')
    )
  );

-- Suppression logique : uploader uniquement (soft delete via deleted_at)
CREATE POLICY "order_files_soft_delete_uploader" ON order_files
  FOR UPDATE USING (uploader_id = auth.uid())
  WITH CHECK (
    deleted_at IS NOT NULL AND
    deleted_by = auth.uid()
  );
```

### 8.5 Table `disputes`

```sql
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Lecture : participants de la commande
CREATE POLICY "disputes_select_participant" ON disputes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = disputes.order_id
        AND (orders.client_id = auth.uid() OR orders.freelance_id = auth.uid())
    )
  );

-- Insertion : participants de la commande (un seul litige par commande, géré par la contrainte UNIQUE)
CREATE POLICY "disputes_insert_participant" ON disputes
  FOR INSERT WITH CHECK (
    opened_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = disputes.order_id
        AND (orders.client_id = auth.uid() OR orders.freelance_id = auth.uid())
        AND orders.status IN ('IN_PROGRESS', 'DELIVERED', 'VALIDATED')
    )
  );

-- Mise à jour de la décision : admin uniquement
CREATE POLICY "disputes_update_admin_only" ON disputes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'oriupe_admin'
    )
  );
```

---

## Annexe — Checklist d'implémentation

### Phase 1 : Base de données (Semaine 1)
- [ ] Activer l'extension `uuid-ossp` et `pg_cron`
- [ ] Créer tous les types ENUM
- [ ] Créer les tables dans l'ordre : `orders` → `escrow_transactions` → `disputes` → `collaboration_messages` → `order_files`
- [ ] Créer les index
- [ ] Créer la fonction `generate_escrow_code()`
- [ ] Activer RLS et créer toutes les politiques
- [ ] Configurer le bucket Supabase Storage `orders` avec les bonnes ACL

### Phase 2 : Webhooks Mobile Money (Semaine 2)
- [ ] Créer les Edge Functions : `/webhooks/cinetpay` et `/webhooks/fedapay`
- [ ] Tester les webhooks en sandbox (CinetPay sandbox, FedaPay sandbox)
- [ ] Implémenter la vérification HMAC-SHA256
- [ ] Journaliser tous les webhooks dans `escrow_transactions.webhook_payload`

### Phase 3 : API Endpoints (Semaine 3)
- [ ] Implémenter tous les 7 endpoints listés au §3
- [ ] Tests unitaires des transitions d'état
- [ ] Tests d'intégration avec les PSP en sandbox

### Phase 4 : Automatisation (Semaine 4)
- [ ] Configurer les jobs `pg_cron` (auto-validation, annulation 24h)
- [ ] Tester le flux complet en staging
- [ ] Audit de sécurité des politiques RLS
- [ ] Mise en production avec monitoring (Supabase Logs + alertes)

---

*Document interne Oriupe — Confidentiel*
