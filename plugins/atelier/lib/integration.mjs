// EPIC with an integration branch (`integration_branch: yes`): the option in the spec header and
// the base of a chantier, i.e. the branch its work starts from and is reviewed against.
// Pure functions: no access to the disk, git or the environment.

import { headerOf, parseRelations } from './relations.mjs'

// ---------- Integration branch ----------

export const INTEGRATION_FIELD = 'integration_branch'

const OPTION_VALUES = ['yes', 'no']

function isEpicHeader(data) {
  return (data?.type ?? '').toUpperCase() === 'EPIC'
}

// Whether the header declares the option; an absent or empty value means no.
export function hasIntegrationBranch(data) {
  return isEpicHeader(data) && data?.[INTEGRATION_FIELD] === 'yes'
}

// Problems of the option in a spec header, as a list.
export function integrationOptionProblems(data) {
  const value = data?.[INTEGRATION_FIELD]
  if (value === undefined || value === null || value === '') {
    return []
  }
  if (!isEpicHeader(data)) {
    return [`En-tête : « ${INTEGRATION_FIELD} » ne concerne qu’un EPIC (type : ${data?.type || '?'}) ; retire-le.`]
  }
  if (!OPTION_VALUES.includes(value)) {
    return [`En-tête : « ${INTEGRATION_FIELD} » doit valoir yes ou no (valeur : « ${value} »).`]
  }
  return []
}

// Integration branch of an EPIC, from the name of its directory.
export function integrationBranchName(directory) {
  return `epic/${directory}`
}

// Base of a chantier whose parent is `parentId` (null without parent): the integration branch of
// the closest ancestor EPIC declaring the option, following `rel_parent` from the parent; otherwise
// `defaultBranch` (null when unknown). An EPIC is not its own ancestor: its base is that of its
// parent. A parent missing from the index or a `rel_parent` cycle gives the default branch and a
// warning. `index` comes from buildChantierIndex. Returns { branch, epic, warning }.
export function chantierBase(index, parentId, defaultBranch) {
  const fallback = (warning = null) => ({ branch: defaultBranch ?? null, epic: null, warning })
  const visited = new Set()
  let current = parentId ? String(parentId).toUpperCase() : null
  while (current) {
    if (visited.has(current)) {
      return fallback(`Base : cycle rel_parent (${[...visited, current].join(' → ')}) ; base prise sur la branche par défaut.`)
    }
    visited.add(current)
    const entry = index.get(current)
    const data = headerOf(entry)
    if (!data) {
      return fallback(`Base : le parent ${current} est introuvable dans les branches du projet ; base prise sur la branche par défaut.`)
    }
    if (hasIntegrationBranch(data)) {
      if (!entry.directory) {
        return fallback(`Base : dossier de l’EPIC ${current} introuvable ; base prise sur la branche par défaut.`)
      }
      return { branch: integrationBranchName(entry.directory), epic: current, warning: null }
    }
    current = parseRelations(data).parent[0] ?? null
  }
  return fallback()
}

// Git reference to use for the integration branch `branch`, from what git says about its local
// branch and its remote-tracking branch (`local`, `remote`: whether each exists; `localInRemote`,
// `remoteInLocal`: whether one contains the other). The more advanced one when one contains the
// other; never the default branch. Returns { ref: 'local' | 'remote' } or { error }.
export function integrationRefChoice({ branch, local, remote, localInRemote = false, remoteInLocal = false }) {
  if (!local && !remote) {
    return { error: `la branche d’intégration ${branch} est introuvable, ni locale ni distante : récupère-la (git fetch) ou pousse-la.` }
  }
  if (!local || (remote && localInRemote)) {
    return { ref: 'remote' }
  }
  if (!remote || remoteInLocal) {
    return { ref: 'local' }
  }
  return { error: `la branche d’intégration ${branch} et sa branche distante ont divergé : synchronise-la (git pull, puis git push) avant de continuer.` }
}
