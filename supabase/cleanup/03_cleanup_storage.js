#!/usr/bin/env node
/**
 * 03_cleanup_storage.js
 * Liste et supprime les fichiers Storage liés aux profils demo/test.
 *
 * UTILISATION :
 *   node supabase/cleanup/03_cleanup_storage.js          # dry-run
 *   node supabase/cleanup/03_cleanup_storage.js --delete # suppression réelle
 *
 * CONFIGURATION :
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  || 'https://oektssjdpzlltmynbxgp.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY manquante.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const isDryRun = !process.argv.includes('--delete')

// Préfixes UUID demo → tout fichier dont le chemin COMMENCE par ces préfixes
const DEMO_UUID_PREFIXES = [
  '10000000-0000-0000-0000-',  // clients
  '20000000-0000-0000-0000-',  // freelances
  '30000000-0000-0000-0000-',  // admins
  'demo-client-',
  'demo-freelance-',
]

// Chemins demo explicites (regex)
const DEMO_PATH_PATTERNS = [
  /^demo\//i,
  /^test\//i,
  /^seed\//i,
  /\/demo\//i,
  /\/test\//i,
]

function isDemoFile(path) {
  if (DEMO_UUID_PREFIXES.some(p => path.startsWith(p))) return true
  if (DEMO_PATH_PATTERNS.some(r => r.test(path))) return true
  return false
}

// Buckets à inspecter (définis dans 013_storage_realtime.sql)
const BUCKETS = [
  'avatars',
  'services',
  'portfolio',
  'kyc-documents',
  'order-deliveries',
  'contracts',
  'messages',
]

async function listAllFiles(bucket) {
  const files = []
  async function scan(prefix = '') {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset: 0 })
    if (error || !data) return
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) {
        // C'est un fichier
        files.push(fullPath)
      } else {
        // C'est un dossier → descendre récursivement
        await scan(fullPath)
      }
    }
  }
  await scan()
  return files
}

async function main() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Oriupe — Cleanup Storage')
  console.log(isDryRun ? '  MODE : DRY-RUN' : '  MODE : SUPPRESSION RÉELLE')
  console.log('══════════════════════════════════════════════\n')

  for (const bucket of BUCKETS) {
    console.log(`\n── Bucket : ${bucket} ──`)

    const allFiles = await listAllFiles(bucket)
    console.log(`   Total fichiers : ${allFiles.length}`)

    if (allFiles.length === 0) { console.log('   (vide)'); continue }

    const demoFiles = allFiles.filter(isDemoFile)
    const realFiles = allFiles.filter(f => !isDemoFile(f))

    console.log(`   Fichiers demo  : ${demoFiles.length}`)
    console.log(`   Fichiers réels : ${realFiles.length}`)

    if (demoFiles.length > 0) {
      console.log('   Fichiers demo trouvés :')
      demoFiles.forEach(f => console.log(`     🗑️  ${f}`))
    }

    if (realFiles.length > 0 && realFiles.length <= 20) {
      console.log('   Fichiers réels conservés :')
      realFiles.forEach(f => console.log(`     ✅  ${f}`))
    } else if (realFiles.length > 20) {
      console.log(`   (${realFiles.length} fichiers réels conservés — non listés)`)
    }

    if (!isDryRun && demoFiles.length > 0) {
      // Supprimer par lots de 20 (limite Supabase)
      const chunks = []
      for (let i = 0; i < demoFiles.length; i += 20) {
        chunks.push(demoFiles.slice(i, i + 20))
      }
      let deleted = 0, errors = 0
      for (const chunk of chunks) {
        const { data, error } = await supabase.storage.from(bucket).remove(chunk)
        if (error) {
          console.error(`   ❌  Erreur suppression : ${error.message}`)
          errors += chunk.length
        } else {
          deleted += chunk.length
        }
      }
      console.log(`   ✅  ${deleted} fichiers supprimés, ${errors} erreurs`)
    }
  }

  console.log('\n══════════════════════════════════════════════')
  if (isDryRun) {
    console.log('  DRY-RUN terminé. Aucun fichier supprimé.')
    console.log('  Pour supprimer : node 03_cleanup_storage.js --delete')
  } else {
    console.log('  Cleanup Storage terminé.')
  }
  console.log('══════════════════════════════════════════════\n')
}

main().catch(e => { console.error(e); process.exit(1) })
