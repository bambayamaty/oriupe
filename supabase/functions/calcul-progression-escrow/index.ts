/**
 * calcul-progression-escrow — Retourne la progression escrow d'une commande
 *
 * GET ?order_id=<uuid>   ou   POST { order_id }
 * Auth : JWT utilisateur (client ou freelance de la commande)
 *
 * Variables env requises :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, respond, respondError } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const STATUS_PROGRESS: Record<string, number> = {
  pending_payment:    0,
  paid:              20,
  in_progress:       40,
  revision_requested: 45,
  delivered:         70,
  completed:        100,
  disputed:          50,
  cancelled:          0,
  refunded:           0,
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment:    'En attente de paiement',
  paid:              'Fonds sécurisés',
  in_progress:       'Travaux en cours',
  revision_requested: 'Révision demandée',
  delivered:         'Livraison effectuée',
  completed:         'Clôturé',
  disputed:          'Litige en cours',
  cancelled:         'Annulée',
  refunded:          'Remboursée',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return respondError('Authentification requise', 401)
    const token = authHeader.slice(7)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return respondError('Token invalide', 401)

    // Résoudre order_id
    let order_id = new URL(req.url).searchParams.get('order_id')
    if (!order_id && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      order_id = body.order_id
    }
    if (!order_id) return respondError('order_id requis')

    // Charger la commande
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id, ref, title, status,
        amount_total_cents, commission_cents, amount_net_cents,
        commission_rate,
        client_id, freelance_id,
        deadline, auto_validate_at,
        paid_at, started_at, delivered_at, completed_at, cancelled_at,
        delivery_days, revisions_included, revisions_used,
        escrow_transactions(status, amount_secured_cents, amount_released_cents),
        disputes(id, status)
      `)
      .eq('id', order_id)
      .single()

    if (error || !order) return respondError('Commande introuvable', 404)

    // Vérifier que l'utilisateur est partie prenante
    const fpRow = await supabase
      .from('freelance_profiles')
      .select('profile_id')
      .eq('id', order.freelance_id)
      .single()

    const isClient = order.client_id === user.id
    const isFreelance = fpRow.data?.profile_id === user.id
    const isAdmin = !isClient && !isFreelance

    if (!isClient && !isFreelance) {
      // Vérifier si admin
      const { data: adminRole } = await supabase
        .from('admin_roles')
        .select('role')
        .eq('profile_id', user.id)
        .single()
      if (!adminRole) return respondError('Accès refusé', 403)
    }

    const progress = STATUS_PROGRESS[order.status] ?? 0
    const escrow = Array.isArray(order.escrow_transactions)
      ? order.escrow_transactions[0]
      : order.escrow_transactions
    const dispute = Array.isArray(order.disputes)
      ? order.disputes[0]
      : order.disputes

    const timeline = [
      {
        step: 'PAYMENT',
        label: 'Paiement',
        status: order.paid_at ? 'done' : order.status === 'pending_payment' ? 'active' : 'pending',
        at: order.paid_at,
      },
      {
        step: 'STARTED',
        label: 'Démarrage',
        status: order.started_at ? 'done' : order.status === 'paid' ? 'active' : 'pending',
        at: order.started_at,
      },
      {
        step: 'DELIVERY',
        label: 'Livraison',
        status: order.delivered_at ? 'done' : ['in_progress','revision_requested'].includes(order.status) ? 'active' : 'pending',
        at: order.delivered_at,
        auto_validate_at: order.auto_validate_at,
      },
      {
        step: 'VALIDATION',
        label: 'Validation',
        status: order.status === 'completed' ? 'done' : order.status === 'delivered' ? 'active' : 'pending',
        at: order.completed_at,
      },
      {
        step: 'TRANSFER',
        label: 'Virement',
        status: order.status === 'completed' && order.completed_at ? 'done' : 'pending',
        at: null,
      },
    ]

    return respond({
      order_id: order.id,
      ref: order.ref,
      title: order.title,
      status: order.status,
      status_label: STATUS_LABELS[order.status] || order.status,
      progress_percent: progress,
      amounts: {
        total_cents: order.amount_total_cents,
        commission_cents: order.commission_cents,
        commission_rate: Number(order.commission_rate),
        net_cents: order.amount_net_cents,
        secured_cents: escrow?.amount_secured_cents ?? 0,
        released_cents: escrow?.amount_released_cents ?? 0,
      },
      escrow_status: escrow?.status ?? null,
      timeline,
      deadline: order.deadline,
      revisions: {
        included: order.revisions_included,
        used: order.revisions_used,
        remaining: Math.max(0, order.revisions_included - order.revisions_used),
      },
      dispute: dispute ? { id: dispute.id, status: dispute.status } : null,
      viewer_role: isClient ? 'client' : isFreelance ? 'freelance' : 'admin',
    })
  } catch (err) {
    console.error('[calcul-progression-escrow]', err)
    return respondError('Erreur interne', 500)
  }
})
