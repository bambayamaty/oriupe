/**
 * cinetpay-webhook — Webhook entrant CinetPay (paiement client)
 *
 * CinetPay POST ce endpoint quand un paiement est confirmé ou échoue.
 * Vérifie la signature HMAC-SHA256, met à jour l'order + l'escrow.
 *
 * Variables env requises :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   CINETPAY_SECRET_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, respond, respondError } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function verifySignature(payload: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get('CINETPAY_SECRET_KEY')
  if (!secret) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === signature
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.text()
    const signature = req.headers.get('x-cinetpay-signature') || ''

    if (!(await verifySignature(body, signature))) {
      return respondError('Signature invalide', 401)
    }

    const payload = JSON.parse(body)
    const {
      cpm_trans_id,       // notre external_ref stocké dans payment_transactions
      cpm_result,         // '00' = succès
      cpm_amount,
      cpm_currency,
      cpm_payment_date,
      cpm_error_message,
    } = payload

    if (!cpm_trans_id) return respondError('cpm_trans_id manquant')

    // Récupérer la payment_transaction par external_ref
    const { data: pt, error: ptErr } = await supabase
      .from('payment_transactions')
      .select('id, order_id, escrow_id, amount_cents, status')
      .eq('external_ref', cpm_trans_id)
      .single()

    if (ptErr || !pt) return respondError('Transaction introuvable', 404)
    if (pt.status === 'completed') return respond({ status: 'already_processed' })

    const success = cpm_result === '00'
    const newStatus = success ? 'completed' : 'failed'

    // Mettre à jour payment_transaction
    await supabase
      .from('payment_transactions')
      .update({
        status: newStatus,
        external_status: cpm_result,
        webhook_payload: payload,
        processed_at: success ? new Date().toISOString() : null,
        failure_reason: success ? null : cpm_error_message,
      })
      .eq('id', pt.id)

    if (!success) {
      return respond({ status: 'payment_failed', reason: cpm_error_message })
    }

    // Paiement confirmé → mettre à jour order + escrow
    const now = new Date().toISOString()

    await supabase
      .from('orders')
      .update({ status: 'paid', paid_at: now })
      .eq('id', pt.order_id)
      .eq('status', 'pending_payment')

    await supabase
      .from('escrow_transactions')
      .update({
        status: 'funds_secured',
        amount_secured_cents: pt.amount_cents,
        payment_ref: cpm_trans_id,
        payment_metadata: payload,
      })
      .eq('order_id', pt.order_id)

    // Enregistrer l'événement escrow
    const { data: escrow } = await supabase
      .from('escrow_transactions')
      .select('id')
      .eq('order_id', pt.order_id)
      .single()

    if (escrow) {
      await supabase.from('escrow_events').insert({
        escrow_id: escrow.id,
        event_type: 'payment_received',
        amount_cents: pt.amount_cents,
        note: `Paiement CinetPay confirmé — réf: ${cpm_trans_id}`,
        metadata: { cpm_result, cpm_payment_date },
      })
    }

    // Notifier le client et le freelance
    const { data: order } = await supabase
      .from('orders')
      .select('client_id, freelance_id, ref, title, freelance_profiles(profile_id)')
      .eq('id', pt.order_id)
      .single()

    if (order) {
      const notifs = [
        {
          user_id: order.client_id,
          type: 'payment_received',
          title: 'Paiement confirmé',
          body: `Votre paiement pour "${order.title}" a été sécurisé en escrow.`,
          data: { order_id: pt.order_id, ref: order.ref },
          action_url: `/src/pages/dashboard/escrow/index.html?order=${pt.order_id}`,
        },
        {
          user_id: (order.freelance_profiles as { profile_id: string })?.profile_id,
          type: 'order_paid',
          title: 'Nouvelle commande payée',
          body: `La commande "${order.title}" (${order.ref}) est prête à démarrer.`,
          data: { order_id: pt.order_id, ref: order.ref },
          action_url: `/src/pages/dashboard/freelance/index.html`,
        },
      ].filter(n => n.user_id)

      await supabase.from('notifications').insert(notifs)
    }

    return respond({ status: 'payment_processed', order_id: pt.order_id })
  } catch (err) {
    console.error('[cinetpay-webhook]', err)
    return respondError('Erreur interne', 500)
  }
})
