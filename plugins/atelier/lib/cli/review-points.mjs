// Review point command: review-ids.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { nextReviewIds } from '../review-points.mjs'
import { findProjectRoot, requireConfig } from './common.mjs'
import { requireActiveChantier } from './identifiers.mjs'

// ---------- Review point identifiers ----------

export function commandReviewIds(options) {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const readText = (name) => {
    const filePath = join(chantier.directory, name)
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : null
  }
  const ids = nextReviewIds({ revue: chantier.revue, spec: readText('spec.md'), decisions: readText('decisions.md') })
  if (options.includes('--json')) {
    console.log(JSON.stringify(ids, null, 2))
    return
  }
  const next = Object.entries(ids.next).map(([prefix, number]) => `${prefix}${number}`).join(', ')
  const open = ids.open.map(({ id, title, section }) => `- ${id}. ${title} (section « ${section} »)`)
  console.log(`Prochains identifiants : ${next}.`)
  console.log(open.length ? `Points de revue ouverts :\n${open.join('\n')}` : 'Aucun point de revue ouvert.')
}
