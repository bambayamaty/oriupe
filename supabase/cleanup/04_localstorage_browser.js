/**
 * 04_localstorage_browser.js
 * Nettoyer les données Oriupe du localStorage navigateur.
 *
 * UTILISATION :
 *   Ouvrir DevTools (F12) > Console
 *   Copier-coller ce script et appuyer sur Entrée
 *
 * Ce script supprime :
 *   - Sessions Oriupe (oriupe_session)
 *   - Données demo/pending (projets, services, commandes, messages, reviews en attente)
 *   - Brouillons (services, projets)
 *   - Likes demo (oriupe_liked)
 *   - Conversations et messages pending
 *
 * Ce script conserve (par défaut) :
 *   - Préférences UI (thème, langue, devise)
 *   - Toute clé non liée à Oriupe
 */

(function() {
  'use strict';

  // ── Clés à supprimer systématiquement ─────────────────────────────
  const KEYS_TO_DELETE = [
    // Session (sera recréée à la reconnexion)
    'oriupe_session',

    // Données en attente (ne doivent pas persister après cleanup)
    'oriupe_pending_projects',
    'oriupe_pending_services',
    'oriupe_pending_convs',
    'oriupe_pending_msgs',
    'oriupe_pending_reviews',
    'oriupe_pending_orders',

    // Likes/favoris (liés à la session)
    'oriupe_liked',

    // Brouillons
    'oriupe_draft_service',
    'oriupe_publish_project_draft',

    // Profil local (remplacé par Supabase)
    'oriupe_profile',
    'oriupe_portfolio',
    'oriupe_experiences',
    'oriupe_certifications',
    'oriupe_freelance_profile',
    'oriupe_client_profile',

    // Conversations et messages demo
    'oriupe_convs',
    'oriupe_msgs',
    'oriupe_conversations',
    'oriupe_messages',

    // Auth tokens demo
    'oriupe_auth_token',
    'oriupe_refresh_token',
    'oriupe_demo_session',

    // Notifications locales
    'oriupe_notifications',
    'oriupe_unread',
  ]

  // ── Préférences à conserver ────────────────────────────────────────
  const KEYS_TO_KEEP = [
    'oriupe_theme',      // dark/light
    'oriupe_lang',       // fr/en
    'oriupe_currency',   // XOF/GHS etc.
    'oriupe_nav_state',  // état du menu
  ]

  const deleted = []
  const kept = []
  const unknown_oriupe = []

  // Supprimer les clés explicites
  KEYS_TO_DELETE.forEach(key => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key)
      deleted.push(key)
    }
  })

  // Identifier les autres clés Oriupe non listées
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (!key.startsWith('oriupe_') && !key.startsWith('sb-')) continue
    if (KEYS_TO_DELETE.includes(key)) continue
    if (KEYS_TO_KEEP.includes(key)) { kept.push(key); continue }
    // Clé Supabase interne (auth)
    if (key.startsWith('sb-')) { continue }
    unknown_oriupe.push(key)
  }

  // ── Rapport ───────────────────────────────────────────────────────
  console.group('%c🧹 Oriupe localStorage cleanup', 'color:#3CB878;font-weight:bold;font-size:14px')

  if (deleted.length > 0) {
    console.log('%c✅ Clés supprimées :', 'color:#3CB878;font-weight:bold')
    deleted.forEach(k => console.log('   🗑️ ', k))
  } else {
    console.log('%cAucune clé Oriupe trouvée à supprimer.', 'color:#aaa')
  }

  if (kept.length > 0) {
    console.log('%c💾 Préférences conservées :', 'color:#29ABE2;font-weight:bold')
    kept.forEach(k => console.log('   ✓ ', k, '=', localStorage.getItem(k)))
  }

  if (unknown_oriupe.length > 0) {
    console.log('%c⚠️  Clés Oriupe non listées (vérifier manuellement) :', 'color:#F5A623;font-weight:bold')
    unknown_oriupe.forEach(k => console.log('   ❓ ', k, '=', localStorage.getItem(k)))
  }

  console.log('')
  console.log(
    `%cRésumé : ${deleted.length} supprimée(s) · ${kept.length} conservée(s) · ${unknown_oriupe.length} à vérifier`,
    'color:#666'
  )
  console.groupEnd()

  return {
    deleted,
    kept,
    to_review: unknown_oriupe,
    summary: `${deleted.length} supprimées, ${kept.length} conservées, ${unknown_oriupe.length} à vérifier`
  }
})()
