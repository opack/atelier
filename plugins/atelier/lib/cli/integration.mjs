// Base of a chantier read from the project: `atelier base --parent <ID>` and the base shown by status.

import { chantierBase } from '../integration.mjs'
import { parseRelations } from '../relations.mjs'
import { findProjectRoot, requireConfig } from './common.mjs'
import { defaultBaseRef, defaultBranchName } from './identifiers.mjs'
import { chantierIndex } from './relations.mjs'

// ---------- Base of a chantier ----------

function defaultBranchOf(projectRoot) {
  const base = defaultBaseRef(projectRoot)
  return base ? defaultBranchName(projectRoot, base) : null
}

// Base of a chantier whose parent is `parentId` (see chantierBase). The index of chantiers is only
// built for a chantier with a parent; `index` reuses one already built.
export function baseOfParent(projectRoot, config, parentId, index = null) {
  const defaultBranch = defaultBranchOf(projectRoot)
  if (!parentId) {
    return { branch: defaultBranch, epic: null, warning: null }
  }
  return chantierBase(index ?? chantierIndex(projectRoot, config), parentId, defaultBranch)
}

// Base of the active chantier, from the parent declared in its spec.
export function chantierBaseOf(projectRoot, config, chantier, index = null) {
  return baseOfParent(projectRoot, config, parseRelations(chantier?.spec?.data).parent[0] ?? null, index)
}

export function commandBase(options) {
  const position = options.indexOf('--parent')
  const parentId = position >= 0 ? options[position + 1] : null
  if (!parentId || parentId.startsWith('-')) {
    console.error('Usage : atelier base --parent <ID> (base d’un chantier à ouvrir sous l’EPIC <ID>)')
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const { branch, warning } = baseOfParent(projectRoot, config, parentId)
  if (warning) {
    console.error(warning)
  }
  if (!branch) {
    console.error('Branche par défaut inconnue (ni origin/HEAD, ni main, ni master).')
    process.exit(2)
  }
  console.log(branch)
}
