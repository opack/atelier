// Spec commands: check-spec, sign, and the writes of the spec header and amendments.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontMatter, setFrontMatterValues, toProjectRelativePath } from '../common.mjs'
import { hasRelations, relationProblems } from '../relations.mjs'
import { appendAmendmentEntry, checkSpec } from '../spec.mjs'
import { findProjectRoot, gitUserName, loadConfig, requireConfig, today } from './common.mjs'
import { requireActiveChantier } from './identifiers.mjs'
import { chantierIndex } from './relations.mjs'

// ---------- Spec commands ----------

export function updateSpec(projectRoot, config, values) {
  const chantier = requireActiveChantier(projectRoot, config)
  const specPath = join(chantier.directory, 'spec.md')
  writeFileSync(specPath, setFrontMatterValues(readFileSync(specPath, 'utf8'), values))
  return { chantier, specPath }
}

export function appendAmendment(specPath, entry) {
  writeFileSync(specPath, appendAmendmentEntry(readFileSync(specPath, 'utf8'), entry))
}

// Spec problems, relations included when atelier is installed: { problems, notes }.
function specProblems(projectRoot, config, text) {
  const problems = checkSpec(text)
  const { data } = parseFrontMatter(text)
  if (!hasRelations(data)) {
    return { problems, notes: [] }
  }
  if (!config) {
    return { problems, notes: ['Relations (rel_*) non vérifiées : atelier n’est pas installé dans ce projet (pas de .claude/atelier.json).'] }
  }
  return { problems: [...problems, ...relationProblems(data, chantierIndex(projectRoot, config))], notes: [] }
}

export function commandCheckSpec([path]) {
  const projectRoot = findProjectRoot()
  const { problems, notes } = specProblems(projectRoot, loadConfig(projectRoot), readFileSync(path, 'utf8'))
  notes.forEach((note) => console.log(note))
  if (problems.length === 0) {
    console.log('Spec complète.')
    return
  }
  console.log(problems.map((problem) => `- ${problem}`).join('\n'))
  process.exitCode = 2
}

export function commandSign() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const status = chantier.spec.data.status || 'draft'
  if (status !== 'draft') {
    console.error(`Signature refusée : la spec de ${chantier.id} est déjà « ${status} ». Seule une spec en brouillon se signe.`)
    process.exit(2)
  }
  const { problems } = specProblems(projectRoot, config, readFileSync(join(chantier.directory, 'spec.md'), 'utf8'))
  if (problems.length) {
    console.error(`Spec incomplète, signature refusée :\n${problems.map((problem) => `- ${problem}`).join('\n')}`)
    process.exit(2)
  }
  const { specPath } = updateSpec(projectRoot, config, {
    status: 'signed',
    signed_by: gitUserName(projectRoot),
    signed_at: today(),
  })
  console.log(toProjectRelativePath(projectRoot, specPath))
}
