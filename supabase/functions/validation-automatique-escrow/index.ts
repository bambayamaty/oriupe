/**
 * validation-automatique-escrow — Cron job: auto-valide les commandes livrées J+7
 *
 * Planifier dans Supabase Dashboard → Edge Functions → Schedules :
 *   schedule: "0 * * * *"  (toutes les heures)
 *
 * Logique :
 *   - Cherche les orders `status = 'delivered'` avec `auto_validate_at <= NOW()`
 *   - Les passe en `completed`, déclenche la libération escrow
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const now = new Date().toISOString()

    // Récupérer toutes les commandes éligibles à l'auto-validation
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, ref, title, client_id, freelance_id, freelance_profiles:freelance_id(profile_id)')
      .eq('status', 'delivered')
      .lte('auto_validate_at', now)
      .limit(50)

    if (error) throw error
    if (!orders?.length) return respond({ status: 'nothing_to_validate', count: 0 })

    const results: { order_id: string; status: string }[] = []

    for (const order of orders) {
      try {
        // Valider la commande
        await supabase
          .from('orders')
          .update({ status: 'completed', completed_at: now })
          .eq('id', order.id)
          .eq('status', 'delivered') // guard contre race conditions

        // Mettre à jour l'escrow
        await supabase
          .from('escrow_transactions')
          .update({ status: 'validated' })
          .eq('order_id', order.id)

        // Déclencher la libération des fonds (appel interne)
        const releaseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/liberation-paiement-escrow`
        fetch(releaseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ order_id: order.id }),
        }).catch(e => console.error('[auto-validation] liberation call failed:', e))

        // Notifier le client et le freelance
        const freelanceProfileId = (order.freelance_profiles as { profile_id: string })?.profile_id
        const notifs = [
          {
            user_id: order.client_id,
            type: 'order_auto_validated',
            title: 'Commande validée automatiquement',
            body: `La commande "${order.title}" a été validée automatiquement après 7 jours sans action de votre part.`,
            data: { order_id: order.id, ref: order.ref },
            action_url: `/src/pages/dashboard/client/index.html`,
          },
          freelanceProfileId && {
            user_id: freelanceProfileId,
            type: 'payment_sent',
            title: 'Paiement en cours',
            body: `La commande "${order.title}" a été validée. Votre paiement est en cours de traitement.`,
            data: { order_id: order.id, ref: order.ref },
            action_url: `/src/pages/dashboard/freelance/index.html`,
          },
        ].filter(Boolean)

        await supabase.from('notifications').insert(notifs)
        results.push({ order_id: order.id, status: 'validated' })
      } catch (e) {
        console.error(`[auto-validation] order ${order.id} failed:`, e)
        results.push({ order_id: order.id, status: 'error' })
      }
    }

    return respond({ status: 'done', count: results.length, results })
  } catch (err) {
    console.error('[validation-automatique-escrow]', err)
    return respondError('Erreur interne', 500)
  }
})
