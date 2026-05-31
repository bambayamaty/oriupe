/**
 * montee-niveau-freelance — Vérifie et applique une montée de niveau freelance
 *
 * Appelé après chaque order complété (via trigger ou edge function enchaînée).
 * Corps : { freelance_profile_id: string }
 *
 * Seuils de niveau (basés sur completed_orders + avg_rating) :
 *   new       →  confirmed  :  5 commandes
 *   confirmed →  expert     : 20 commandes, rating ≥ 4.0
 *   expert    →  top_oriupe : 50 commandes, rating ≥ 4.5
 *   top_oriupe → elite      :100 commandes, rating ≥ 4.8
 *
 * Commission associée (migration 016) :
 *   new/confirmed : 12% | expert : 10% | top_oriupe : 8% | elite : 5%
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

const LEVEL_THRESHOLDS = [
  { from: 'new',        to: 'confirmed',  min_orders:   5, min_rating: 0.0 },
  { from: 'confirmed',  to: 'expert',     min_orders:  20, min_rating: 4.0 },
  { from: 'expert',     to: 'top_oriupe', min_orders:  50, min_rating: 4.5 },
  { from: 'top_oriupe', to: 'elite',      min_orders: 100, min_rating: 4.8 },
]

const LEVEL_COMMISSION: Record<string, number> = {
  new: 0.12, confirmed: 0.12, expert: 0.10, top_oriupe: 0.08, elite: 0.05,
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { freelance_profile_id } = await req.json()
    if (!freelance_profile_id) return respondError('freelance_profile_id requis')

    const { data: fp, error } = await supabase
      .from('freelance_profiles')
      .select('id, profile_id, level, completed_orders, avg_rating')
      .eq('id', freelance_profile_id)
      .single()

    if (error || !fp) return respondError('Profil freelance introuvable', 404)

    const threshold = LEVEL_THRESHOLDS.find(t =>
      t.from === fp.level &&
      fp.completed_orders >= t.min_orders &&
      Number(fp.avg_rating) >= t.min_rating,
    )

    if (!threshold) {
      return respond({
        status: 'no_change',
        current_level: fp.level,
        completed_orders: fp.completed_orders,
        avg_rating: fp.avg_rating,
        next_threshold: LEVEL_THRESHOLDS.find(t => t.from === fp.level) || null,
      })
    }

    // Appliquer la montée de niveau
    await supabase
      .from('freelance_profiles')
      .update({ level: threshold.to })
      .eq('id', freelance_profile_id)

    // Mettre à jour le commission_rate sur les futurs orders (via platform_settings ou profil)
    const newCommission = LEVEL_COMMISSION[threshold.to] ?? 0.12

    // Notifier le freelance
    const levelLabels: Record<string, string> = {
      confirmed: 'Confirmé',
      expert: 'Expert',
      top_oriupe: 'Top Oriupe',
      elite: 'Elite',
    }

    await supabase.from('notifications').insert({
      user_id: fp.profile_id,
      type: 'level_up',
      title: `Nouveau niveau : ${levelLabels[threshold.to] || threshold.to}`,
      body: `Félicitations ! Vous avez atteint le niveau ${levelLabels[threshold.to]}. Votre taux de commission est maintenant de ${Math.round(newCommission * 100)}%.`,
      data: {
        old_level: threshold.from,
        new_level: threshold.to,
        commission_rate: newCommission,
      },
      action_url: `/src/pages/dashboard/freelance/index.html`,
    })

    return respond({
      status: 'level_up',
      old_level: threshold.from,
      new_level: threshold.to,
      new_commission_rate: newCommission,
      completed_orders: fp.completed_orders,
      avg_rating: fp.avg_rating,
    })
  } catch (err) {
    console.error('[montee-niveau-freelance]', err)
    return respondError('Erreur interne', 500)
  }
})
