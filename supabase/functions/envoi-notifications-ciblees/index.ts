/**
 * envoi-notifications-ciblees — Envoi multicanal : email (Brevo) + SMS (Africa's Talking)
 *
 * Corps :
 *   {
 *     user_id: string,
 *     template: string,           // clé template ex: 'order_confirmed', 'kyc_approved'
 *     data: Record<string, any>,  // variables du template
 *     channels: ('email'|'sms'|'push')[],
 *   }
 *
 * Variables env requises :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   BREVO_API_KEY, VITE_BREVO_SENDER_EMAIL, VITE_BREVO_SENDER_NAME
 *   AT_API_KEY, AT_USERNAME, AT_SENDER_ID
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, respond, respondError } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// ── Templates ────────────────────────────────────────────────────────────────

type Template = {
  subject: string
  emailHtml: (data: Record<string, string>) => string
  smsText: (data: Record<string, string>) => string
  pushTitle: string
  pushBody: (data: Record<string, string>) => string
  action_url?: (data: Record<string, string>) => string
  notification_type: string
}

const TEMPLATES: Record<string, Template> = {
  order_confirmed: {
    notification_type: 'order_confirmed',
    subject: 'Votre commande Oriupe est confirmée',
    emailHtml: (d) => `<p>Bonjour ${d.first_name},</p><p>Votre commande <strong>${d.order_ref}</strong> — "${d.order_title}" a bien été enregistrée et le paiement de <strong>${d.amount} FCFA</strong> est sécurisé en escrow.</p><p><a href="${d.dashboard_url}" style="background:#3CB878;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:10px">Voir ma commande</a></p>`,
    smsText: (d) => `[Oriupe] Commande ${d.order_ref} confirmée. ${d.amount} FCFA sécurisés en escrow. Suivez sur oriupe.com`,
    pushTitle: 'Commande confirmée',
    pushBody: (d) => `Votre commande "${d.order_title}" (${d.order_ref}) est confirmée.`,
    action_url: (d) => `/src/pages/dashboard/client/index.html`,
  },
  payment_received: {
    notification_type: 'payment_received',
    subject: 'Paiement reçu — Votre virement Oriupe',
    emailHtml: (d) => `<p>Bonjour ${d.first_name},</p><p>Votre virement de <strong>${d.amount} FCFA</strong> pour la commande <strong>${d.order_ref}</strong> a été effectué avec succès sur votre compte Mobile Money.</p>`,
    smsText: (d) => `[Oriupe] Virement de ${d.amount} FCFA recu pour commande ${d.order_ref}. Merci de votre confiance !`,
    pushTitle: 'Paiement reçu',
    pushBody: (d) => `${d.amount} FCFA virés pour la commande ${d.order_ref}.`,
    action_url: () => `/src/pages/dashboard/freelance/index.html`,
  },
  kyc_approved: {
    notification_type: 'kyc_approved',
    subject: 'Votre identité Oriupe a été vérifiée',
    emailHtml: (d) => `<p>Bonjour ${d.first_name},</p><p>Bonne nouvelle ! Votre identité a été vérifiée avec succès par notre équipe. Vous pouvez maintenant accéder à toutes les fonctionnalités de la plateforme.</p><p><a href="/src/pages/dashboard/freelance/index.html" style="background:#3CB878;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:10px">Accéder à mon espace</a></p>`,
    smsText: (d) => `[Oriupe] ${d.first_name}, votre identite a ete verifiee avec succes ! Toutes les fonctionnalites sont maintenant accessibles.`,
    pushTitle: 'Identité vérifiée',
    pushBody: (d) => 'Votre vérification KYC a été approuvée.',
    action_url: () => `/src/pages/dashboard/freelance/index.html`,
  },
  kyc_rejected: {
    notification_type: 'kyc_rejected',
    subject: 'Action requise — Vérification KYC Oriupe',
    emailHtml: (d) => `<p>Bonjour ${d.first_name},</p><p>Votre dossier KYC n'a pas pu être approuvé. Motif : <strong>${d.reason || 'documents non conformes'}</strong>.</p><p>Vous pouvez soumettre de nouveaux documents sur votre espace Oriupe.</p>`,
    smsText: (d) => `[Oriupe] Votre dossier KYC a ete refuse. Motif: ${d.reason || 'documents non conformes'}. Resoumettez sur oriupe.com`,
    pushTitle: 'Documents requis',
    pushBody: (d) => `Votre dossier KYC a été refusé : ${d.reason || 'documents non conformes'}.`,
    action_url: () => `/src/pages/onboarding/index.html`,
  },
  dispute_opened: {
    notification_type: 'dispute_opened',
    subject: 'Litige ouvert sur votre commande Oriupe',
    emailHtml: (d) => `<p>Bonjour ${d.first_name},</p><p>Un litige a été ouvert sur la commande <strong>${d.order_ref}</strong>. Notre équipe va analyser la situation et vous contactera dans les 48h.</p>`,
    smsText: (d) => `[Oriupe] Litige ouvert sur commande ${d.order_ref}. Notre equipe intervient dans les 48h.`,
    pushTitle: 'Litige ouvert',
    pushBody: (d) => `Un litige a été ouvert sur la commande ${d.order_ref}.`,
    action_url: (d) => `/src/pages/disputes/index.html`,
  },
}

// ── Brevo email ───────────────────────────────────────────────────────────────

async function sendEmail(to: string, toName: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get('BREVO_API_KEY')
  if (!apiKey) { console.warn('[notifs] BREVO_API_KEY manquant'); return false }

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: Deno.env.get('VITE_BREVO_SENDER_EMAIL') || 'noreply@oriupe.com',
        name: Deno.env.get('VITE_BREVO_SENDER_NAME') || 'Oriupe',
      },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;color:#1B3A4A;max-width:600px;margin:0 auto;padding:20px">${html}<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/><p style="font-size:11px;color:#9CA3AF">Oriupe · Plateforme freelance africaine · <a href="https://oriupe.com">oriupe.com</a></p></body></html>`,
    }),
  })

  return resp.ok
}

// ── Africa's Talking SMS ──────────────────────────────────────────────────────

async function sendSMS(phone: string, message: string): Promise<boolean> {
  const apiKey   = Deno.env.get('AT_API_KEY')
  const username = Deno.env.get('AT_USERNAME')
  if (!apiKey || !username) { console.warn('[notifs] AT_API_KEY/AT_USERNAME manquant'); return false }

  const params = new URLSearchParams({
    username,
    to: phone,
    message,
    from: Deno.env.get('AT_SENDER_ID') || 'Oriupe',
  })

  const resp = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  return resp.ok
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { user_id, template: templateKey, data = {}, channels = ['push'] } = await req.json()
    if (!user_id || !templateKey) return respondError('user_id et template requis')

    const tpl = TEMPLATES[templateKey]
    if (!tpl) return respondError(`Template inconnu: ${templateKey}`)

    // Charger le profil utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone')
      .eq('id', user_id)
      .single()

    if (!profile) return respondError('Utilisateur introuvable', 404)

    const tplData = {
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      ...data,
    }

    const results: Record<string, boolean> = {}

    // Notification in-app (toujours créée)
    await supabase.from('notifications').insert({
      user_id,
      type: tpl.notification_type,
      title: tpl.pushTitle,
      body: tpl.pushBody(tplData),
      data: tplData,
      action_url: tpl.action_url?.(tplData) || null,
    })
    results.push = true

    if (channels.includes('email') && profile.email) {
      results.email = await sendEmail(
        profile.email,
        `${profile.first_name} ${profile.last_name}`.trim(),
        tpl.subject,
        tpl.emailHtml(tplData),
      )
    }

    if (channels.includes('sms') && profile.phone) {
      results.sms = await sendSMS(profile.phone, tpl.smsText(tplData))
    }

    return respond({ status: 'sent', channels: results })
  } catch (err) {
    console.error('[envoi-notifications-ciblees]', err)
    return respondError('Erreur interne', 500)
  }
})
