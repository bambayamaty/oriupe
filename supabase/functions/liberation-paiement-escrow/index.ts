/**
 * liberation-paiement-escrow — Initie le virement escrow vers le freelance
 *
 * Appelé automatiquement après validation d'une commande (client ou auto).
 * Initie un transfert CinetPay sortant et met l'escrow en `transferring`.
 *
 * Corps : { order_id: string }
 * Auth  : service role (interne) ou admin JWT
 *
 * Variables env requises :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   CINETPAY_SITE_ID, CINETPAY_API_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, respond, respondError } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { order_id } = await req.json()
    if (!order_id) return respondError('order_id requis')

    // Charger la commande avec les données freelance
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id, ref, title, status,
        amount_net_cents, commission_cents,
        client_id, freelance_id,
        freelance_profiles:freelance_id(
          profile_id,
          payout_phone,
          payout_operator,
          profiles:profile_id(first_name, last_name, email)
        )
      `)
      .eq('id', order_id)
      .single()

    if (error || !order) return respondError('Commande introuvable', 404)

    if (order.status !== 'completed') {
      return respondError(`Statut incompatible: ${order.status} (attendu: completed)`, 409)
    }

    const fp = order.freelance_profiles as {
      profile_id: string
      payout_phone: string | null
      payout_operator: string | null
      profiles: { first_name: string; last_name: string; email: string }
    }

    if (!fp?.payout_phone || !fp?.payout_operator) {
      return respondError('Coordonnées bancaires du freelance manquantes', 422)
    }

    const amountFCFA = Math.floor((order.amount_net_cents || 0) / 100)
    if (amountFCFA <= 0) return respondError('Montant net invalide', 422)

    // Mettre l'escrow en `transferring`
    await supabase
      .from('escrow_transactions')
      .update({ status: 'transferring' })
      .eq('order_id', order_id)

    // Appel CinetPay Transfer API
    const cinetpayRef = `ORIUPE-OUT-${order.ref}-${Date.now()}`
    let transferResult = null
    let transferError = null

    try {
      const resp = await fetch('https://client.cinetpay.com/v1/transfer/money/send/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: Deno.env.get('CINETPAY_API_KEY'),
          prefix: fp.payout_phone.replace(/[^0-9]/g, '').substring(0, 3),
          phone: fp.payout_phone,
          amount: amountFCFA,
          currency: 'XOF',
          client_transaction_id: cinetpayRef,
          notify_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/confirmation-virement`,
        }),
      })
      transferResult = await resp.json()
      if (transferResult?.code !== '0') {
        transferError = transferResult?.message || 'Échec CinetPay Transfer'
      }
    } catch (e) {
      transferError = (e as Error).message
    }

    // Enregistrer la payment_transaction sortante
    await supabase.from('payment_transactions').insert({
      order_id,
      initiated_by: order.client_id,
      amount_cents: order.amount_net_cents,
      currency: 'XOF',
      operator: fp.payout_operator as string,
      provider: 'cinetpay',
      status: transferError ? 'failed' : 'processing',
      external_ref: cinetpayRef,
      external_status: transferResult?.code || null,
      webhook_payload: transferResult,
      failure_reason: transferError,
    })

    // Événement escrow
    const { data: escrow } = await supabase
      .from('escrow_transactions')
      .select('id')
      .eq('order_id', order_id)
      .single()

    if (escrow) {
      await supabase.from('escrow_events').insert({
        escrow_id: escrow.id,
        event_type: 'transfer_initiated',
        amount_cents: order.amount_net_cents,
        note: transferError
          ? `Erreur virement: ${transferError}`
          : `Virement initié — réf: ${cinetpayRef}`,
        metadata: { cinetpayRef, transferResult },
      })
    }

    // Notifier le freelance
    if (fp.profile_id && !transferError) {
      await supabase.from('notifications').insert({
        user_id: fp.profile_id,
        type: 'payment_sent',
        title: 'Virement en cours',
        body: `${amountFCFA.toLocaleString('fr-FR')} FCFA sont en cours de virement vers votre compte.`,
        data: { order_id, ref: order.ref },
        action_url: `/src/pages/dashboard/freelance/index.html`,
      })
    }

    if (transferError) {
      return respond({ status: 'transfer_failed', error: transferError, order_id }, 202)
    }

    return respond({ status: 'transfer_initiated', ref: cinetpayRef, order_id, amount_fcfa: amountFCFA })
  } catch (err) {
    console.error('[liberation-paiement-escrow]', err)
    return respondError('Erreur interne', 500)
  }
})
