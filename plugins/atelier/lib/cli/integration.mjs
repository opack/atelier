// Base of a chantier read from the project: `atelier base --parent <ID>` and the base shown by status.

import { chantierBase, integrationRefChoice } from '../integration.mjs'
import { parseRelations } from '../relations.mjs'
import { findProjectRoot, gitObjectExists, isAncestor, requireConfig } from './common.mjs'
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

const REMOTE = 'origin'

// Existing refs of the integration branch `branch`: { local, remote }, each a full ref or null.
function integrationRefs(projectRoot, branch) {
  const existing = (ref) => (gitObjectExists(projectRoot, `${ref}^{commit}`) ? ref : null)
  return { local: existing(`refs/heads/${branch}`), remote: existing(`refs/remotes/${REMOTE}/${branch}`) }
}

// The integration branch imposed on the chantier by an ancestor EPIC, with its existing refs:
// { branch, local, remote } (each ref full, or null); null when the chantier's base is the default
// branch. Computed once per command and passed to baseRefOf and integrationRefsOf.
export function integrationBranchOf(projectRoot, config, chantier, index = null) {
  const base = chantierBaseOf(projectRoot, config, chantier, index)
  return base.epic ? { branch: base.branch, ...integrationRefs(projectRoot, base.branch) } : null
}

// Git ref the chantier's work is compared with: the default base ref (see defaultBaseRef) without
// `integration`, otherwise the ref of the integration branch chosen by integrationRefChoice. Throws
// when the integration branch has diverged from its remote or is missing: falling back to the
// default branch would count the work of the other children of the EPIC.
export function baseRefOf(projectRoot, integration) {
  if (!integration) {
    return defaultBaseRef(projectRoot)
  }
  const { branch, local, remote } = integration
  const both = Boolean(local && remote)
  const choice = integrationRefChoice({
    branch,
    local: Boolean(local),
    remote: Boolean(remote),
    localInRemote: both && isAncestor(projectRoot, local, remote),
    remoteInLocal: both && isAncestor(projectRoot, remote, local),
  })
  if (choice.error) {
    throw new Error(choice.error)
  }
  return choice.ref === 'local' ? local : remote
}

// Existing refs of the integration branch (see integrationBranchOf), [] without one: commits
// reachable from them are the EPIC's and the other children's, not the chantier's.
export function integrationRefsOf(integration) {
  return integration ? [integration.local, integration.remote].filter(Boolean) : []
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
