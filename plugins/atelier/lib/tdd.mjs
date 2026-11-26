// Test-driven phases of a chantier: freezing, refreezing and reopening the tests.
// Pure functions: no access to the disk, git or the environment.

import { specStatus } from './common.mjs'
import { sliceState } from './slices.mjs'
import { ENTRY_START, parseAmendments } from './spec.mjs'
import { VOCABULARY } from './vocabulary.mjs'

// ---------- Test-driven phases ----------

// TDD that applies to the current slice: `slice_tdd` (written by the atelier command from the
// plan) when set, otherwise the `tdd` of the chantier.
export function effectiveTdd(chantier) {
  const data = chantier?.spec?.data ?? {}
  return declaredSliceTdd(data.slice_tdd) ?? data.tdd
}

// A slice TDD value read without case: 'yes' | 'no', or null when empty or unknown.
export function declaredSliceTdd(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['yes', 'no'].includes(normalized) ? normalized : null
}

// The current slice when it is a numbered slice of a chantier with several slices, else null.
export function numberedSlice(chantier) {
  const { model, slice } = sliceState(chantier)
  return model === 'sliced' && typeof slice === 'number' ? slice : null
}

// Whether a reopening of the tests is pending: the last « tests rouverts » entry of the spec is
// not followed by a « tests regelés » entry.
function reopeningPending(chantier) {
  return isRefreeze(parseAmendments(chantier?.spec?.body ?? '').entries)
}

// Refusal of freeze-tests and reopen-tests in a slice without TDD (phase « none » in a numbered
// slice of a chantier with several slices), or null.
function sliceWithoutTddRefusal(chantier) {
  const slice = numberedSlice(chantier)
  if (slice === null || testDrivenPhase(chantier) !== 'none') {
    return null
  }
  return `la tranche ${slice} est sans TDD : pas de tests à figer ni à rouvrir, ils s’écrivent avec le code (/atelier:build).`
}

// Why `atelier freeze-tests` cannot start in the current phase, or null.
export function freezeTestsPhaseRefusal(chantier) {
  const withoutTdd = sliceWithoutTddRefusal(chantier)
  if (withoutTdd) {
    return withoutTdd
  }
  return testDrivenPhase(chantier) === 'writing-tests' ? null : 'ce chantier n’est pas en phase « tests d’abord ».'
}

// Refusal of freeze-tests when the last commit holds no test file.
export const FREEZE_WITHOUT_TEST_MESSAGE = 'Le dernier commit ne contient aucun fichier de test. Commite les tests (et seulement les tests) avant de les figer. Une tranche qui n’a rien à tester se déclare « TDD : non » au plan ; en cours de tranche : atelier set-tdd no <raison>.'

// 'none'          : no « tests first » for the current slice: the chantier or the slice does not
//                   follow TDD (decided by the human), or the review of the whole chantier.
// 'writing-tests' : TDD, tests are being written; implementation code is forbidden.
// 'implementing'  : tests are committed and frozen; only implementation code may change.
// Tests frozen under TDD (of the chantier or of the slice, or during the review of the whole
// chantier) stay frozen whatever the plan says; a chantier switched to `tdd: no` after the
// freeze, without slice TDD, has no frozen tests.
// During the review of the whole chantier, tests are only written after a reopening, still
// pending.
export function testDrivenPhase(chantier) {
  const { model, slice } = sliceState(chantier)
  if (model === 'none') {
    return 'none'
  }
  const data = chantier?.spec?.data ?? {}
  if (data.tests_commit && (data.tdd === 'yes' || effectiveTdd(chantier) === 'yes' || slice === 'chantier')) {
    return 'implementing'
  }
  if (slice === 'chantier') {
    return isRefreeze(parseAmendments(chantier.spec.body ?? '').entries) ? 'writing-tests' : 'none'
  }
  return effectiveTdd(chantier) === 'yes' ? 'writing-tests' : 'none'
}

// Fixed labels of the entries written by the atelier command.
export function reopenTestsEntry(date, commit, reason) {
  return `${date} : ${VOCABULARY.amendmentEntries.reopened} (${VOCABULARY.amendmentEntries.leftFreeze} : ${commit}) : ${reason}`
}

export function refreezeTestsEntry(date, commit) {
  return `${date} : ${VOCABULARY.amendmentEntries.refrozen} : ${commit}`
}

// Whether freezing the tests now is a refreeze: the last "tests rouverts" entry comes after the
// last "tests regelés" entry (or there is none). Position decides, not dates. The pre-0.2.0
// format (`tests rouverts : <raison>`) starts the same way.
export function isRefreeze(entries) {
  const lastIndexOf = (label) => entries.findLastIndex((entry) => entry.replace(ENTRY_START, '').startsWith(label))
  const lastReopen = lastIndexOf(VOCABULARY.amendmentEntries.reopened)
  return lastReopen >= 0 && lastReopen > lastIndexOf(VOCABULARY.amendmentEntries.refrozen)
}

// Why `atelier reopen-tests` is refused for this chantier, or null. `frozenBefore` is true when
// a slice of the chantier froze tests (a `tests_commit` in the history of the spec): during the
// review of the whole chantier, it allows a reopening even if the chantier is not in TDD.
export function reopenTestsRefusal(chantier, { frozenBefore = false } = {}) {
  const data = chantier?.spec?.data ?? {}
  if (specStatus(chantier?.spec) !== 'signed') {
    return `La spec de ${chantier?.id ?? 'ce chantier'} n’est pas signée (statut : ${specStatus(chantier?.spec)}) : ses tests ne se rouvrent pas.`
  }
  const withoutTdd = sliceWithoutTddRefusal(chantier)
  if (withoutTdd) {
    return `${withoutTdd.charAt(0).toUpperCase()}${withoutTdd.slice(1)}`
  }
  const { slice } = sliceState(chantier)
  const tddFrozen = slice === 'chantier' ? data.tdd === 'yes' || frozenBefore : testDrivenPhase(chantier) !== 'none'
  if (!tddFrozen) {
    return `${chantier?.id ?? 'Ce chantier'} ne suit pas le TDD (tdd: ${data.tdd || '?'}) : il n’a pas de tests figés à rouvrir. Ajoute ou modifie les tests avec le code (/atelier:build).`
  }
  if (!data.tests_commit) {
    // « Tests d'abord » of a slice N > 1 or the review of the whole chantier: the tests of the
    // previous slices are frozen. After a reopening, the tests are already reopened.
    if (data.slice_base && reopeningPending(chantier)) {
      return `tests déjà rouverts pour ${chantier.id} : modifie-les, commite-les puis fige-les (atelier freeze-tests).`
    }
    if (!(slice === 'chantier' || (typeof slice === 'number' && slice >= 2)) || !data.slice_base) {
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

// A line without any whitespace, as `git diff --ignore-all-space` compares lines.
export function withoutSpaces(line) {
  return line.replace(/\s+/g, '')
}

// Test files whose changes in a `git diff` output (frozen state to HEAD) are not explained by merges
// of the default branch: a removed line, or an added line found in none of the merged versions of
// the file (`mergedLines(file)`: a Set of lines normalized by withoutSpaces). Deleted and binary
// files are left to git's file lists, as in removedTestLines' callers.
// Blank added lines are ignored; lines are compared without whitespace, like the diff (-w).
export function testFilesChangedByChantier(diff, mergedLines) {
  const files = new Set()
  let oldFile = null
  let newFile = null
  let inHunk = false
  for (const line of diff.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('diff --git ')) {
      oldFile = newFile = null
      inHunk = false
    } else if (!inHunk && line.startsWith('--- ')) {
      oldFile = line === '--- /dev/null' ? null : line.slice(4).replace(/\t$/, '').replace(/^a\//, '')
    } else if (!inHunk && line.startsWith('+++ ')) {
      newFile = line === '+++ /dev/null' ? null : line.slice(4).replace(/\t$/, '').replace(/^b\//, '')
    } else if (line.startsWith('@@')) {
      inHunk = true
    } else if (inHunk && line.startsWith('-') && oldFile) {
      files.add(oldFile)
    } else if (inHunk && line.startsWith('+') && newFile) {
      const added = withoutSpaces(line.slice(1))
      if (added && !mergedLines(newFile).has(added)) files.add(newFile)
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

// Why `atelier set-tdd <value>` is refused for this chantier, or null. In a numbered slice of a
// chantier with several slices, it changes the TDD of that slice only: refused once its tests are
// frozen (the slice stays in TDD), and `no` refused while a reopening of the tests is pending.
export function setTddRefusal(chantier, value) {
  if (value === 'yes' && (chantier?.spec?.data?.type ?? '').toUpperCase() === 'EPIC') {
    return `${chantier.id} est un EPIC : il n’implémente rien, il reste en « tdd: no ».`
  }
  const slice = numberedSlice(chantier)
  if (slice === null || chantier.spec.data.status !== 'signed') {
    return null
  }
  if (testDrivenPhase(chantier) === 'implementing') {
    return `les tests de la tranche ${slice} sont figés (${chantier.spec.data.tests_commit}) : elle reste en TDD. Pour corriger ses tests, rouvre-les (atelier reopen-tests <raison>).`
  }
  if (value === 'no' && reopeningPending(chantier)) {
    return `des tests rouverts attendent d’être regelés (atelier freeze-tests) : la tranche ${slice} ne peut pas passer sans TDD avant.`
  }
  return null
}

// What `atelier set-tdd <value> <reason>` writes on `date`: the `tdd` of the chantier, or the
// `slice_tdd` of the current numbered slice of a chantier with several slices once signed. The
// amendment entry is null for a spec that is not signed.
export function setTddUpdate(chantier, value, date, reason = '') {
  const signed = chantier.spec.data.status === 'signed'
  const slice = signed ? numberedSlice(chantier) : null
  const change = value === 'yes' ? 'activé' : 'désactivé'
  const suffix = reason ? ` : ${reason}` : ''
  if (slice !== null) {
    return { values: { slice_tdd: value }, entry: `${date} : TDD de la tranche ${slice} : ${change}${suffix}` }
  }
  // A slice TDD written outside a numbered slice (a plan with a single slice) follows the chantier.
  const sliceTdd = String(chantier.spec.data.slice_tdd ?? '').trim() ? { slice_tdd: value } : {}
  return { values: { tdd: value, ...sliceTdd }, entry: signed ? `${date} : TDD ${change}${suffix}` : null }
}
