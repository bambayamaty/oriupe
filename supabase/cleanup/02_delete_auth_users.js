#!/usr/bin/env node
/**
 * 02_delete_auth_users.js
 * Supprime les comptes Supabase Auth des utilisateurs test/demo.
 *
 * PRÉREQUIS :
 *   npm install @supabase/supabase-js
 *
 * UTILISATION :
 *   node supabase/cleanup/02_delete_auth_users.js          # dry-run (liste uniquement)
 *   node supabase/cleanup/02_delete_auth_users.js --delete # suppression réelle
 *
 * CONFIGURATION :
 *   Mettre SUPABASE_SERVICE_ROLE_KEY dans l'environnement ou dans le fichier .env
 *   Ne jamais utiliser la clé anon — seule la service_role peut supprimer des users Auth.
 */

import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  || 'https://oektssjdpzlltmynbxgp.supabase.co'

// La service_role KEY n'est JAMAIS dans .env côté frontend.
// Récupérer dans Supabase Dashboard > Settings > API > service_role
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('\n❌  SUPABASE_SERVICE_ROLE_KEY manquante.')
  console.error('   Exporter la variable :')
  console.error('   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."')
  console.error('   (Supabase Dashboard > Settings > API > service_role secret)\n')
  process.exit(1)
}

// ── Emails test à supprimer ───────────────────────────────────────────
// Seuls ces emails seront ciblés — aucun autre compte ne sera touché.
const DEMO_EMAILS = [
  // Comptes clients seed
  'awa.mbaye@oriupe.com',
  'ibrahim.c@oriupe.com',
  'fatou.d@oriupe.com',
  'chukwudi@oriupe.com',
  'marie.ndoye@oriupe.com',
  'yussuf.k@oriupe.com',
  'aminata.t@oriupe.com',
  'emeka.n@oriupe.com',
  'sandrine.b@oriupe.com',
  'oumar.ba@oriupe.com',
  // Comptes freelances seed
  'kofi.asante@oriupe.com',
  'moussa.t@oriupe.com',
  'aissatou.sow@oriupe.com',
  'daniel.osei@oriupe.com',
  'adaeze.eze@oriupe.com',
  'seun.a@oriupe.com',
  'bocar.d@oriupe.com',
  'cynthia.n@oriupe.com',
  'serge.o@oriupe.com',
  'lea.mendy@oriupe.com',
  'kwabena.b@oriupe.com',
  'nadia.bench@oriupe.com',
  'jules.a@oriupe.com',
  'grace.w@oriupe.com',
  'mamadou.k@oriupe.com',
  // Comptes admins seed
  'admin@oriupe.com',
  'moderateur@oriupe.com',
  'support@oriupe.com',
  'finance@oriupe.com',
  'team@oriupe.com',
  'dev@oriupe.com',
  // Comptes test éventuels créés manuellement
  'client@oriupe.com',
  'freelance@oriupe.com',
  // Comptes demo (si créés via auth)
  'amadou@demo.oriupe.com',
  'fatou@demo.oriupe.com',
  // Anciens comptes test connus
  'kofi@test.oriupe.com',
  'aminata@test.oriupe.com',
]

// Emails à NE JAMAIS supprimer (liste blanche de sécurité)
const PROTECTED_EMAILS = [
  'bambayamaty@gmail.com',
]

// ── Client Admin ──────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const isDryRun = !process.argv.includes('--delete')

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Oriupe — Suppression comptes Auth test')
  console.log(isDryRun ? '  MODE : DRY-RUN (lecture seule)' : '  MODE : SUPPRESSION RÉELLE')
  console.log('══════════════════════════════════════════════\n')

  // Récupérer tous les users Auth (pagination par 1000)
  let allUsers = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.error('Erreur listUsers:', error.message); process.exit(1) }
    allUsers = allUsers.concat(data.users || [])
    if (!data.users || data.users.length < 1000) break
    page++
  }

  console.log(`Total comptes Auth trouvés : ${allUsers.length}`)

  // Filtrer
  const toDelete = allUsers.filter(u => {
    if (!u.email) return false
    if (PROTECTED_EMAILS.includes(u.email)) return false
    return DEMO_EMAILS.includes(u.email)
  })

  const unknown = allUsers.filter(u => {
    if (!u.email) return false
    if (PROTECTED_EMAILS.includes(u.email)) return false
    if (DEMO_EMAILS.includes(u.email)) return false
    return true
  })

  // Afficher les protégés
  console.log('\n✅  Comptes protégés (non touchés) :')
  allUsers.filter(u => PROTECTED_EMAILS.includes(u.email)).forEach(u => {
    console.log(`   ${u.email} (${u.id})`)
  })

  // Afficher ce qui sera supprimé
  console.log(`\n🗑️   Comptes DEMO à supprimer (${toDelete.length}) :`)
  if (toDelete.length === 0) {
    console.log('   (aucun compte demo trouvé dans Auth)')
  } else {
    toDelete.forEach(u => console.log(`   ${u.email} (${u.id})`))
  }

  // Alertes comptes inconnus
  if (unknown.length > 0) {
    console.log(`\n⚠️   Comptes INCONNUS (non listés, non supprimés — vérifier manuellement) :`)
    unknown.forEach(u => console.log(`   ${u.email} (${u.id})`))
  }

  if (isDryRun) {
    console.log('\n──────────────────────────────────────────────')
    console.log('  DRY-RUN terminé. Aucune suppression.')
    console.log('  Pour supprimer : node 02_delete_auth_users.js --delete')
    console.log('──────────────────────────────────────────────\n')
    return
  }

  // ── Suppression effective ─────────────────────────────────────────
  if (toDelete.length === 0) {
    console.log('\n  Rien à supprimer.\n')
    return
  }

  console.log(`\n  Suppression de ${toDelete.length} compte(s)...\n`)
  let ok = 0, fail = 0

  for (const u of toDelete) {
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) {
      console.error(`   ❌  ${u.email} — ${error.message}`)
      fail++
    } else {
      console.log(`   ✅  ${u.email} supprimé`)
      ok++
    }
    // Pause pour éviter rate-limiting
    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n══════════════════════════════════════════════')
  console.log(`  Résultat : ${ok} supprimés, ${fail} erreurs`)
  console.log('══════════════════════════════════════════════\n')
}

main().catch(e => { console.error(e); process.exit(1) })
