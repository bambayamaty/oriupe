-- ═══════════════════════════════════════════════════════════════════
-- 001_enums.sql — Tous les types énumérés Oriupe
-- ═══════════════════════════════════════════════════════════════════

-- Rôle utilisateur principal
CREATE TYPE user_role AS ENUM (
  'client',       -- acheteur de services
  'freelance',    -- prestataire
  'admin',        -- équipe Oriupe
  'visitor'       -- non connecté (pas persisté en base, côté session only)
);

-- Sous-type de compte
CREATE TYPE account_type AS ENUM (
  'individual',   -- particulier
  'business'      -- entreprise / agence
);

-- Statut du compte utilisateur
CREATE TYPE account_status AS ENUM (
  'active',
  'pending_kyc',      -- compte créé, KYC non soumis
  'kyc_submitted',    -- KYC soumis, en attente de validation
  'suspended',        -- suspension temporaire
  'banned',           -- bannissement définitif
  'deactivated'       -- compte désactivé à la demande
);

-- Statut KYC
CREATE TYPE kyc_status AS ENUM (
  'not_submitted',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'expired'
);

-- Niveau freelance
CREATE TYPE freelance_level AS ENUM (
  'new',
  'confirmed',
  'expert',
  'top_oriupe',
  'elite'
);

-- Statut de disponibilité
CREATE TYPE availability_status AS ENUM (
  'available',
  'busy',
  'unavailable'
);

-- Statut d'un service
CREATE TYPE service_status AS ENUM (
  'draft',
  'pending_review',
  'published',
  'rejected',
  'paused',
  'archived'
);

-- Statut d'un projet client
CREATE TYPE project_status AS ENUM (
  'draft',
  'pending_review',
  'open',             -- visible freelances, accepte candidatures
  'assigned',         -- freelance retenu, en attente paiement
  'in_progress',
  'completed',
  'cancelled',
  'archived'
);

-- Type de projet
CREATE TYPE project_type AS ENUM (
  'public_tender',    -- appel d'offres ouvert
  'direct_order'      -- commande directe à un freelance ciblé
);

-- Statut d'une proposition freelance
CREATE TYPE proposal_status AS ENUM (
  'pending',
  'shortlisted',
  'accepted',
  'rejected',
  'withdrawn'
);

-- Statut d'une commande — flux principal
CREATE TYPE order_status AS ENUM (
  'pending_payment',      -- créée, paiement non confirmé
  'paid',                 -- paiement capturé
  'in_progress',          -- freelance a démarré
  'delivered',            -- freelance a livré
  'revision_requested',   -- client demande une révision
  'completed',            -- client a validé, escrow libéré
  'disputed',             -- litige ouvert
  'cancelled',            -- annulée avant livraison
  'refunded'              -- remboursement effectué
);

-- Source d'une commande
CREATE TYPE order_source AS ENUM (
  'service',            -- issue d'une page service
  'project_proposal',   -- issue d'une proposition acceptée
  'direct'              -- commandée directement sans service listé
);

-- Statut escrow
CREATE TYPE escrow_status AS ENUM (
  'awaiting_payment',
  'funds_secured',
  'in_progress',
  'delivered',
  'validated',
  'transferring',
  'completed',
  'disputed',
  'partially_refunded',
  'refunded',
  'cancelled'
);

-- Opérateur de paiement
CREATE TYPE payment_operator AS ENUM (
  'orange_money',
  'mtn_momo',
  'wave',
  'moov_money',
  'credit_card',
  'bank_transfer',
  'manual',
  'sandbox'
);

-- Provider de paiement (gateway)
CREATE TYPE payment_provider AS ENUM (
  'cinetpay',
  'fedapay',
  'stripe',
  'paystack',
  'manual',
  'sandbox'
);

-- Statut d'une transaction de paiement
CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded'
);

-- Type de conversation
CREATE TYPE conversation_type AS ENUM (
  'direct',       -- DM entre 2 utilisateurs
  'order',        -- lié à une commande
  'support',      -- ticket support
  'dispute'       -- lié à un litige
);

-- Type de message
CREATE TYPE message_type AS ENUM (
  'text',
  'file',
  'image',
  'system',           -- message automatique (ex: commande créée)
  'escrow_card',      -- carte de suivi escrow
  'delivery',         -- soumission de livraison
  'revision_request'  -- demande de révision
);

-- Rôle admin
CREATE TYPE admin_role AS ENUM (
  'super_admin',
  'admin',
  'moderator',
  'support',
  'finance'
);

-- Catégorie de litige
CREATE TYPE dispute_category AS ENUM (
  'non_livraison',
  'qualite_insuffisante',
  'non_respect_brief',
  'delai_depasse',
  'fraude',
  'autre'
);

-- Statut d'un litige
CREATE TYPE dispute_status AS ENUM (
  'open',
  'under_review',
  'awaiting_response',
  'resolved',
  'closed'
);

-- Décision de litige
CREATE TYPE dispute_decision AS ENUM (
  'refund_client',
  'release_freelance',
  'partial_refund',
  'revision_required',
  'no_action'
);

-- Statut de la queue de modération
CREATE TYPE moderation_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'flagged',
  'escalated'
);

-- Type d'élément à modérer
CREATE TYPE moderation_target_type AS ENUM (
  'service',
  'project',
  'review',
  'post',
  'user',
  'kyc'
);

-- Type de notification
CREATE TYPE notification_type AS ENUM (
  'new_message',
  'new_order',
  'payment_secured',
  'delivery_received',
  'revision_requested',
  'order_completed',
  'project_approved',
  'service_approved',
  'service_rejected',
  'kyc_approved',
  'kyc_rejected',
  'dispute_opened',
  'dispute_resolved',
  'new_proposal',
  'proposal_accepted',
  'payout_sent',
  'review_received',
  'account_suspended'
);

-- Statut d'un post (blog/academy)
CREATE TYPE post_status AS ENUM (
  'draft',
  'published',
  'archived'
);

-- Type de post
CREATE TYPE post_type AS ENUM (
  'blog',
  'academy',
  'guide',
  'news',
  'press'
);

-- Devise
CREATE TYPE currency_code AS ENUM (
  'XOF', -- Franc CFA Ouest
  'XAF', -- Franc CFA Centre
  'GHS', -- Cedi Ghana
  'NGN', -- Naira Nigeria
  'KES', -- Shilling Kenya
  'MAD', -- Dirham Maroc
  'EUR', -- Euro
  'USD'  -- Dollar
);
