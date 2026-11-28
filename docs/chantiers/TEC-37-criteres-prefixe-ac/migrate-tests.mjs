// TEC-37: mechanical migration of the existing tests from the CA-n / V-n criterion prefixes to AC-n.
// Usage: node docs/chantiers/TEC-37-criteres-prefixe-ac/migrate-tests.mjs
// Rewrites the test files in place and prints every changed line. Proof that the migration commit is
// mechanical: check out the tests of its parent, run this script, and compare with the commit:
//   git checkout <migration>^ -- plugins/atelier/test && node <this script> && git diff --stat <migration> -- plugins/atelier/test
// (empty diff expected), then git checkout HEAD -- plugins/atelier/test.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const testDirectory = join(root, 'plugins', 'atelier', 'test')
// Test files written by TEC-37 itself: their refused examples stay in CA-n and V-n.
const EXCLUDED = new Set(['criteria.test.mjs', 'migration.test.mjs'])

// Line rules, applied in order.
const RULES = [
  [/CA couverts/g, 'AC couverts'],
  [/\bCA-(\d+)/g, 'AC-$1'],
  [/\bca-(\d+)/g, 'ac-$1'],
  [/\bV-(\d+)/g, 'AC-$1'],
  [/\bCA\b/g, 'AC'],
]

// architecture.test.mjs: its two criterion expressions move to lib/criteria.mjs (SB2).
const ARCHITECTURE_IMPORT = "import { CHANTIER_TYPES } from '../lib/common.mjs'"
function migrateArchitecture(text) {
  return text
    .replace(ARCHITECTURE_IMPORT, `${ARCHITECTURE_IMPORT}\nimport { CRITERION_ID, FINAL_TAG } from '../lib/criteria.mjs'`)
    .replace(/^const CRITERION_ID = .*\n/m, '')
    .replace(/^const FINAL_TAG = .*\n/m, '')
}

function migrateLine(line) {
  return RULES.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), line)
}

export function migrate(name, text) {
  const base = name === 'architecture.test.mjs' && text.includes('const FINAL_TAG = ') ? migrateArchitecture(text) : text
  return base.split('\n').map(migrateLine).join('\n')
}

let pending = 0
for (const name of readdirSync(testDirectory).filter((file) => file.endsWith('.mjs') && !EXCLUDED.has(file)).sort()) {
  const path = join(testDirectory, name)
  const before = readFileSync(path, 'utf8')
  const after = migrate(name, before)
  if (after === before) continue
  pending++
  console.log(`== ${relative(root, path)}`)
  if (after.includes('../lib/criteria.mjs') && !before.includes('../lib/criteria.mjs')) {
    console.log('import des expressions CRITERION_ID et FINAL_TAG de lib/criteria.mjs (définitions locales retirées)')
  }
  before.split('\n').forEach((line, index) => {
    const migrated = migrateLine(line)
    if (migrated !== line) console.log(`${index + 1}: ${line.trim()}\n   → ${migrated.trim()}`)
  })
  writeFileSync(path, after)
}
console.log(`${pending} fichier(s) migré(s).`)
