// list command: the chantiers of the project, one per line (or as JSON).

import { chantierSteps, formatList, listEntry, listItem, parseListArguments, selectChantiers } from '../list.mjs'
import { shownVersions } from '../list-versions.mjs'
import { findProjectRoot, requireConfig } from './common.mjs'
import { currentBranch } from './identifiers.mjs'
import { chantierIndex } from './relations.mjs'

// One chantier with several directories in the current tree is listed once; the warning names them.
function warnDuplicates(index) {
  for (const { id, hereDirectories } of index.values()) {
    if (hereDirectories.length > 1) {
      console.error(`Attention : ${id} a plusieurs dossiers dans l’arbre courant (${hereDirectories.join(', ')}) ; un seul est listé.`)
    }
  }
}

export function commandList(argumentList) {
  const options = parseListArguments(argumentList)
  if (options.error) {
    console.error(options.error)
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  // Steps are computed on all the known versions, before any filter (an EPIC looks at its children).
  const branch = currentBranch(projectRoot)
  const index = chantierIndex(projectRoot, config, branch)
  warnDuplicates(index)
  const versions = shownVersions(index, branch)
  const steps = chantierSteps(versions)
  const byId = new Map(versions.map((version) => [version.id, version]))
  const { selected, hiddenClosed } = selectChantiers(versions.map((version) => listEntry(version)), options)
  const items = selected.map((entry) => {
    const { location, path } = byId.get(entry.id)
    return listItem(entry, steps.get(entry.id), { location, path })
  })
  console.log(options.json ? JSON.stringify(items, null, 2) : formatList(items, { hiddenClosed }))
}
