// Listing of the chantiers: which version of each chantier is shown when it exists in the current
// tree and on other branches. Pure functions: no access to the disk, git or the environment.

import { specStatus } from './common.mjs'
import { branchNameIdentifiers } from './identifiers.mjs'
import { shownHeader } from './list.mjs'
import { CLOSED_STATUSES } from './relations.mjs'

// The branch with the most recent last commit; on a tie the local one, then the name (so that the
// choice never depends on the order of the refs).
function mostRecent(branches) {
  return [...branches].sort((a, b) => b.date - a.date || Number(b.local) - Number(a.local) || a.branch.localeCompare(b.branch))[0]
}

// The version of an index entry that is shown, by the first rule that applies:
// 1. the current branch carries the identifier and the chantier is in the current tree: the current tree;
// 2. the chantier is closed in the current tree: the current tree (a status never goes back);
// 3. branches carry the identifier: the most recent of them;
// 4. the chantier is in the current tree: the current tree;
// 5. otherwise the most recent of the other branches.
// Returns { facts, location (null: current tree, else the short name of the branch) }, or null
// for an entry without any version.
export function chooseVersion(entry, currentBranch) {
  const here = entry.here ? { facts: entry.hereFacts, location: null } : null
  const onBranch = (branch) => ({ facts: branch.facts, location: branch.branch })
  if (here && branchNameIdentifiers(currentBranch ?? '').includes(entry.id)) {
    return here
  }
  if (here && CLOSED_STATUSES.includes(specStatus({ data: entry.here }))) {
    return here
  }
  const carrying = entry.branches.filter((branch) => branchNameIdentifiers(branch.branch).includes(entry.id))
  if (carrying.length) {
    return onBranch(mostRecent(carrying))
  }
  if (here) {
    return here
  }
  return entry.branches.length ? onBranch(mostRecent(entry.branches)) : null
}

// Shown versions of all the known chantiers: [{ id, ...facts, location, path }], the header
// normalized (shownHeader). `path` is the directory in the current tree, even when the shown
// version comes from a branch; null when the chantier is not in the current tree.
export function shownVersions(index, currentBranch) {
  return [...index.values()].flatMap((entry) => {
    const chosen = chooseVersion(entry, currentBranch)
    if (!chosen) {
      return []
    }
    return [{ id: entry.id, ...chosen.facts, data: shownHeader(entry.id, chosen.facts.data), location: chosen.location, path: entry.herePath }]
  })
}
