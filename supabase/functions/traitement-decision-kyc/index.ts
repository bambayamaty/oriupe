/**
 * traitement-decision-kyc — Admin : approuve ou rejette un dossier KYC
 *
 * Corps :
 *   { kyc_case_id: string, decision: 'approved'|'rejected'|'needs_more_info', reason?: string, verified_name?: string }
 *
 * Auth : JWT admin (vérifié via admin_roles)
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
    // Vérifier l'auth admin via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return respondError('Authentification requise', 401)

    const token = authHeader.slice(7)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return respondError('Token invalide', 401)

    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('profile_id', user.id)
      .in('role', ['super_admin', 'admin', 'moderator'])
      .single()

    if (!adminRole) return respondError('Rôle admin insuffisant', 403)

    const { kyc_case_id, decision, reason, verified_name } = await req.json()
    if (!kyc_case_id || !decision) return respondError('kyc_case_id et decision requis')
    if (!['approved', 'rejected', 'needs_more_info', 'escalated'].includes(decision)) {
      return respondError('Decision invalide')
    }
    if (decision === 'rejected' && !reason) return respondError('Raison requise pour un rejet')

    // Récupérer le dossier KYC avec le profil utilisateur
    const { data: kycCase, error: caseErr } = await supabase
      .from('kyc_cases')
      .select('id, profile_id, status, document_type, profiles:profile_id(first_name, last_name, email)')
      .eq('id', kyc_case_id)
      .single()

    if (caseErr || !kycCase) return respondError('Dossier KYC introuvable', 404)
    if (kycCase.status === 'approved') return respondError('Dossier déjà approuvé', 409)

    const now = new Date().toISOString()

    // Enregistrer la décision (append-only)
    await supabase.from('kyc_reviews').insert({
      kyc_case_id,
      reviewed_by: user.id,
      decision,
      reason: reason || null,
      notes: null,
      verified_name: verified_name || null,
      created_at: now,
    })

    // Mettre à jour le dossier KYC
    const kycStatus = decision === 'approved' ? 'approved'
      : decision === 'rejected' ? 'rejected'
      : 'under_review'

    await supabase
      .from('kyc_cases')
      .update({ status: kycStatus, updated_at: now })
      .eq('id', kyc_case_id)

    // Mettre à jour le profil utilisateur
    if (decision === 'approved' || decision === 'rejected') {
      await supabase
        .from('profiles')
        .update({
          kyc_status: decision === 'approved' ? 'approved' : 'rejected',
          updated_at: now,
        })
        .eq('id', kycCase.profile_id)
    }

    // Notifier l'utilisateur
    const profile = kycCase.profiles as { first_name: string; last_name: string; email: string }
    const notifMap: Record<string, { title: string; body: string }> = {
      approved: {
        title: 'Identité vérifiée',
        body: 'Votre dossier KYC a été approuvé. Vous pouvez maintenant accéder à toutes les fonctionnalités.',
      },
      rejected: {
        title: 'Vérification refusée',
        body: `Votre dossier KYC a été refusé. Motif : ${reason || 'documents non conformes'}. Vous pouvez soumettre à nouveau.`,
      },
      needs_more_info: {
        title: 'Documents supplémentaires requis',
        body: `Votre dossier KYC nécessite des informations supplémentaires : ${reason || 'contactez le support'}.`,
      },
    }

    const notif = notifMap[decision]
    if (notif) {
      await supabase.from('notifications').insert({
        user_id: kycCase.profile_id,
        type: `kyc_${decision}` as string,
        title: notif.title,
        body: notif.body,
        data: { kyc_case_id, decision },
        action_url: `/src/pages/onboarding/index.html`,
      })
    }

    return respond({
      status: 'decision_recorded',
      kyc_case_id,
      decision,
      profile_kyc_status: kycStatus,
      user_email: profile?.email,
    })
  } catch (err) {
    console.error('[traitement-decision-kyc]', err)
    return respondError('Erreur interne', 500)
  }
})
