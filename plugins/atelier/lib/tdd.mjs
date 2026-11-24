// Test-driven phases of a chantier: freezing, refreezing and reopening the tests.
// Pure functions: no access to the disk, git or the environment.

import { specStatus } from './common.mjs'
import { sliceState } from './slices.mjs'
import { ENTRY_START, parseAmendments } from './spec.mjs'

// ---------- Test-driven phases ----------

// 'none'          : the chantier does not follow TDD (`tdd: no`, decided by the human).
// 'writing-tests' : TDD, tests are being written; implementation code is forbidden.
// 'implementing'  : TDD, tests are committed and frozen; only implementation code may change.
export function testDrivenPhase(chantier) {
  const data = chantier?.spec?.data ?? {}
  if (data.tdd !== 'yes') {
    return 'none'
  }
  return data.tests_commit ? 'implementing' : 'writing-tests'
}

// Fixed labels of the entries written by the atelier command.
export function reopenTestsEntry(date, commit, reason) {
  return `${date} : tests rouverts (gel quitté : ${commit}) : ${reason}`
}

export function refreezeTestsEntry(date, commit) {
  return `${date} : tests regelés : ${commit}`
}

// Whether freezing the tests now is a refreeze: the last "tests rouverts" entry comes after the
// last "tests regelés" entry (or there is none). Position decides, not dates. The pre-0.2.0
// format (`tests rouverts : <raison>`) starts the same way.
export function isRefreeze(entries) {
  const lastIndexOf = (label) => entries.findLastIndex((entry) => entry.replace(ENTRY_START, '').startsWith(label))
  const lastReopen = lastIndexOf('tests rouverts')
  return lastReopen >= 0 && lastReopen > lastIndexOf('tests regelés')
}

// Why `atelier reopen-tests` is refused for this chantier, or null.
export function reopenTestsRefusal(chantier) {
  const data = chantier?.spec?.data ?? {}
  if (specStatus(chantier?.spec) !== 'signed') {
    return `La spec de ${chantier?.id ?? 'ce chantier'} n’est pas signée (statut : ${specStatus(chantier?.spec)}) : ses tests ne se rouvrent pas.`
  }
  if (data.tdd !== 'yes') {
    return `${chantier?.id ?? 'Ce chantier'} ne suit pas le TDD (tdd: ${data.tdd || '?'}) : il n’a pas de tests figés à rouvrir. Ajoute ou modifie les tests avec le code (/atelier:build).`
  }
  if (!data.tests_commit) {
    // « Tests d'abord » of a slice N > 1: the tests of the previous slices are frozen.
    // After a reopening (slice N > 1 or the whole-chantier review), the tests are already reopened.
    const { slice } = sliceState(chantier)
    if (data.slice_base && isRefreeze(parseAmendments(chantier.spec.body ?? '').entries)) {
      return `tests déjà rouverts pour ${chantier.id} : modifie-les, commite-les puis fige-les (atelier freeze-tests).`
    }
    if (typeof slice !== 'number' || slice < 2 || !data.slice_base) {
      return `Les tests de ${chantier.id} ne sont pas figés : ils s’écrivent encore, rien à rouvrir (/atelier:write-tests).`
    }
  }
  return null
}

// Test files with removed lines in a `git diff` output (old path: a deleted or renamed file
// counts as removed). Only lines inside hunks count; headers are read before the first hunk.
export function removedTestLines(diff) {
  const files = new Set()
  let file = null
  let inHunk = false
  for (const line of diff.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = null
      inHunk = false
    } else if (!inHunk && line.startsWith('--- ')) {
      file = line === '--- /dev/null' ? null : line.slice(4).replace(/\t$/, '').replace(/^a\//, '')
    } else if (line.startsWith('@@')) {
      inHunk = true
    } else if (inHunk && line.startsWith('-') && file) {
      files.add(file)
    }
  }
  return [...files]
}

// Why `atelier freeze-tests` is refused, or null. `sliceBaseIsAncestor` is false when the
// `slice_base` of the spec is no longer an ancestor of HEAD; `removedTestFiles` are the test
// files with lines removed since `slice_base` (see removedTestLines).
export function freezeTestsRefusal({ chantier, sliceBaseIsAncestor, removedTestFiles }) {
  if (sliceBaseIsAncestor === false) {
    return `le début de la tranche (slice_base : ${chantier.spec.data.slice_base}) n’est plus un ancêtre de HEAD (rebase, historique réécrit). Seul l’utilisateur peut corriger slice_base dans l’en-tête de la spec.`
  }
  if (removedTestFiles.length && !isRefreeze(parseAmendments(chantier.spec.body ?? '').entries)) {
    return `des tests des tranches précédentes ont été modifiés ou supprimés :\n${removedTestFiles.map((file) => `- ${file}`).join('\n')}\nOn ne fait qu’ajouter des tests. Si l’un d’eux doit vraiment changer : /atelier:amend si la spec change, puis /atelier:write-tests <raison>.`
  }
  return null
}

// Spec header values written by `atelier freeze-tests` at `commit`: the first freeze of a
// chantier of the slice cycle also writes `slice: 1`.
export function freezeTestsValues(chantier, commit) {
  const { model } = sliceState(chantier)
  const firstOfCycle = ['single', 'sliced'].includes(model) && !String(chantier.spec.data.slice ?? '').trim()
  return { tests_commit: commit, ...(firstOfCycle ? { slice: '1' } : {}) }
}

// Why `atelier set-tdd <value>` is refused for this chantier, or null.
export function setTddRefusal(chantier, value) {
  if (value === 'yes' && (chantier?.spec?.data?.type ?? '').toUpperCase() === 'EPIC') {
    return `${chantier.id} est un EPIC : il n’implémente rien, il reste en « tdd: no ».`
  }
  return null
}
