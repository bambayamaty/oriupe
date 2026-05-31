/**
 * confirmation-virement — Webhook CinetPay : confirmation virement sortant
 *
 * CinetPay POST ce endpoint quand un virement vers le freelance est confirmé/échoué.
 * Met à jour payment_transactions + escrow_transactions → completed.
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
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === signature
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.text()
    const sig = req.headers.get('x-cinetpay-signature') || ''
    if (!(await verifySignature(body, sig))) return respondError('Signature invalide', 401)

    const payload = JSON.parse(body)
    const {
      client_transaction_id,  // réf interne ORIUPE-OUT-...
      treatment_status,       // 'VAL' = validé, 'REJ' = rejeté
      transaction_id,         // ID CinetPay
      comment,
    } = payload

    if (!client_transaction_id) return respondError('client_transaction_id manquant')

    const { data: pt } = await supabase
      .from('payment_transactions')
      .select('id, order_id, escrow_id, amount_cents, status')
      .eq('external_ref', client_transaction_id)
      .single()

    if (!pt) return respondError('Transaction introuvable', 404)
    if (pt.status === 'completed') return respond({ status: 'already_processed' })

    const success = treatment_status === 'VAL'
    const now = new Date().toISOString()

    await supabase
      .from('payment_transactions')
      .update({
        status: success ? 'completed' : 'failed',
        external_status: treatment_status,
        webhook_payload: payload,
        processed_at: success ? now : null,
        failure_reason: success ? null : comment,
      })
      .eq('id', pt.id)

    const { data: escrow } = await supabase
      .from('escrow_transactions')
      .select('id')
      .eq('order_id', pt.order_id)
      .single()

    if (success) {
      await supabase
        .from('escrow_transactions')
        .update({
          status: 'completed',
          amount_released_cents: pt.amount_cents,
          released_at: now,
        })
        .eq('order_id', pt.order_id)

      if (escrow) {
        await supabase.from('escrow_events').insert({
          escrow_id: escrow.id,
          event_type: 'funds_released',
          amount_cents: pt.amount_cents,
          note: `Virement confirmé — CinetPay ID: ${transaction_id}`,
          metadata: payload,
        })
      }

      // Notifier le freelance de la réception des fonds + déclencher montée de niveau
      const { data: order } = await supabase
        .from('orders')
        .select('ref, title, freelance_id, freelance_profiles:freelance_id(id, profile_id)')
        .eq('id', pt.order_id)
        .single()

      const fp = order?.freelance_profiles as { id: string; profile_id: string } | null
      if (fp?.profile_id) {
        const amountFCFA = Math.floor(pt.amount_cents / 100)
        await supabase.from('notifications').insert({
          user_id: fp.profile_id,
          type: 'payment_received',
          title: 'Paiement reçu',
          body: `${amountFCFA.toLocaleString('fr-FR')} FCFA ont bien été virés sur votre compte Mobile Money.`,
          data: { order_id: pt.order_id, ref: order?.ref },
          action_url: `/src/pages/dashboard/freelance/index.html`,
        })
      }

      // Vérifier montée de niveau freelance (fire-and-forget)
      if (fp?.id) {
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/montee-niveau-freelance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ freelance_profile_id: fp.id }),
        }).catch(e => console.error('[confirmation-virement] montee-niveau call failed:', e))
      }
    } else {
      // Virement échoué → repasser en `validated` pour retry
      await supabase
        .from('escrow_transactions')
        .update({ status: 'validated' })
        .eq('order_id', pt.order_id)

      if (escrow) {
        await supabase.from('escrow_events').insert({
          escrow_id: escrow.id,
          event_type: 'transfer_failed',
          note: `Virement échoué: ${comment}`,
          metadata: payload,
        })
      }
    }

    return respond({ status: success ? 'virement_confirmed' : 'virement_failed', order_id: pt.order_id })
  } catch (err) {
    console.error('[confirmation-virement]', err)
    return respondError('Erreur interne', 500)
  }
})
