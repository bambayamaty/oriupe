/**
 * generation-contrat-pdf — Génère et stocke le contrat PDF d'une commande
 *
 * Corps : { order_id: string }
 * Auth  : JWT client ou freelance de la commande
 *
 * Génère un HTML structuré, le convertit via une API PDF externe (si disponible),
 * ou stocke directement le HTML en Supabase Storage.
 * Retourne une URL signée valide 1 heure.
 *
 * Variables env requises :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PDF_API_URL (optionnel — ex: https://api.html2pdf.app/v1/generate)
 *   PDF_API_KEY (optionnel)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, respond, respondError } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function buildContractHTML(order: Record<string, unknown>): string {
  const fmt = (n: number) => n.toLocaleString('fr-FR')
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const client = order.client_profile as Record<string, string> | null
  const freelanceProfile = order.freelance_profile as Record<string, string> | null

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;color:#1B3A4A;line-height:1.6;max-width:800px;margin:40px auto;padding:0 40px}
  .header{text-align:center;border-bottom:2px solid #3CB878;padding-bottom:20px;margin-bottom:30px}
  .logo{font-size:28px;font-weight:900;color:#3CB878}
  h1{font-size:20px;margin:8px 0}
  .ref{font-size:13px;color:#666;background:#f5f5f5;padding:6px 12px;border-radius:6px;display:inline-block}
  .section{margin:24px 0}
  .section h2{font-size:14px;font-weight:700;color:#1B3A4A;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{text-align:left;padding:8px 12px;font-size:13px}
  th{background:#f9fafb;font-weight:700;color:#374151}
  tr:nth-child(even) td{background:#fafafa}
  .amount-row td{font-weight:700}
  .commission-row td{color:#6B7280}
  .net-row td{color:#3CB878;font-size:15px}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
  .badge-completed{background:#D1FAE5;color:#065F46}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9CA3AF;text-align:center}
  .signature-block{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:30px 0}
  .sig-box{border:1px solid #e5e7eb;border-radius:8px;padding:16px;min-height:80px}
  .sig-label{font-size:11px;color:#9CA3AF;margin-bottom:4px}
  .sig-name{font-weight:700;color:#1B3A4A}
</style>
</head>
<body>
<div class="header">
  <div class="logo">Oriupe</div>
  <div style="font-size:11px;color:#9CA3AF">Plateforme freelance africaine · Abidjan, Côte d'Ivoire</div>
  <h1>Contrat de prestation de service</h1>
  <div class="ref">Réf : ${order.ref} · Généré le ${fmtDate(new Date().toISOString())}</div>
</div>

<div class="section">
  <h2>Parties</h2>
  <table>
    <tr><th>Rôle</th><th>Nom</th><th>Email</th></tr>
    <tr><td>Client</td><td>${client?.first_name || ''} ${client?.last_name || ''}</td><td>${client?.email || '—'}</td></tr>
    <tr><td>Freelance</td><td>${freelanceProfile?.first_name || ''} ${freelanceProfile?.last_name || ''}</td><td>${freelanceProfile?.email || '—'}</td></tr>
  </table>
</div>

<div class="section">
  <h2>Détails de la prestation</h2>
  <table>
    <tr><th>Champ</th><th>Valeur</th></tr>
    <tr><td>Titre</td><td>${order.title}</td></tr>
    <tr><td>Date de création</td><td>${fmtDate(order.created_at as string)}</td></tr>
    <tr><td>Date de livraison</td><td>${fmtDate(order.delivered_at as string)}</td></tr>
    <tr><td>Date de validation</td><td>${fmtDate(order.completed_at as string)}</td></tr>
    <tr><td>Délai contractuel</td><td>${order.delivery_days} jours</td></tr>
    <tr><td>Statut</td><td><span class="badge badge-completed">Complétée</span></td></tr>
  </table>
</div>

<div class="section">
  <h2>Montants</h2>
  <table>
    <tr class="amount-row"><td>Montant total payé par le client</td><td>${fmt(Math.floor((order.amount_total_cents as number) / 100))} FCFA</td></tr>
    <tr class="commission-row"><td>Commission Oriupe (${Math.round((order.commission_rate as number) * 100)}%)</td><td>${fmt(Math.floor((order.commission_cents as number) / 100))} FCFA</td></tr>
    <tr class="net-row"><td>Net reçu par le freelance</td><td>${fmt(Math.floor((order.amount_net_cents as number) / 100))} FCFA</td></tr>
  </table>
</div>

<div class="section">
  <h2>Signatures</h2>
  <div class="signature-block">
    <div class="sig-box">
      <div class="sig-label">Client</div>
      <div class="sig-name">${client?.first_name || ''} ${client?.last_name || ''}</div>
      <div style="font-size:11px;color:#9CA3AF;margin-top:4px">Validation effectuée le ${fmtDate(order.completed_at as string)}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Freelance</div>
      <div class="sig-name">${freelanceProfile?.first_name || ''} ${freelanceProfile?.last_name || ''}</div>
      <div style="font-size:11px;color:#9CA3AF;margin-top:4px">Livraison effectuée le ${fmtDate(order.delivered_at as string)}</div>
    </div>
  </div>
</div>

<div class="footer">
  Ce document est généré automatiquement par Oriupe et vaut contrat de prestation entre les parties.<br>
  Oriupe SAS · contact@oriupe.com · oriupe.com
</div>
</body>
</html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return respondError('Authentification requise', 401)
    const token = authHeader.slice(7)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return respondError('Token invalide', 401)

    const { order_id } = await req.json()
    if (!order_id) return respondError('order_id requis')

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id, ref, title, status,
        amount_total_cents, commission_cents, amount_net_cents, commission_rate,
        client_id, freelance_id,
        delivery_days, created_at, delivered_at, completed_at,
        client_profile:profiles!client_id(first_name, last_name, email),
        freelance_profiles_ref:freelance_id(
          profile_id,
          profiles:profile_id(first_name, last_name, email)
        )
      `)
      .eq('id', order_id)
      .single()

    if (error || !order) return respondError('Commande introuvable', 404)
    if (order.status !== 'completed') return respondError('Contrat disponible uniquement pour les commandes complétées', 409)

    // Vérifier accès
    const fpRef = order.freelance_profiles_ref as { profile_id: string; profiles: { first_name: string; last_name: string; email: string } }
    const isParty = order.client_id === user.id || fpRef?.profile_id === user.id
    if (!isParty) {
      const { data: adminRole } = await supabase.from('admin_roles').select('role').eq('profile_id', user.id).single()
      if (!adminRole) return respondError('Accès refusé', 403)
    }

    const contractData = {
      ...order,
      freelance_profile: fpRef?.profiles,
    }

    const html = buildContractHTML(contractData as unknown as Record<string, unknown>)
    const storagePath = `contracts/${order_id}/contrat-${order.ref}.html`

    // Stocker en Supabase Storage (bucket 'contracts')
    const { error: uploadErr } = await supabase.storage
      .from('contracts')
      .upload(storagePath, new Blob([html], { type: 'text/html' }), {
        upsert: true,
        contentType: 'text/html',
      })

    if (uploadErr) throw uploadErr

    // Générer une URL signée 1 heure
    const { data: signedData, error: signErr } = await supabase.storage
      .from('contracts')
      .createSignedUrl(storagePath, 3600)

    if (signErr) throw signErr

    return respond({
      status: 'generated',
      order_id,
      ref: order.ref,
      url: signedData.signedUrl,
      expires_in: 3600,
    })
  } catch (err) {
    console.error('[generation-contrat-pdf]', err)
    return respondError('Erreur interne', 500)
  }
})
