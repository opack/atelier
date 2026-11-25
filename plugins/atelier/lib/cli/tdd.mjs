// Test commands: freeze-tests, reopen-tests, set-tdd, tests-changed, and the test files changed in git.

import { matchesAny } from '../common.mjs'
import { parseAmendments } from '../spec.mjs'
import {
  freezeTestsRefusal,
  freezeTestsValues,
  isRefreeze,
  refreezeTestsEntry,
  removedTestLines,
  reopenTestsEntry,
  reopenTestsRefusal,
  setTddRefusal,
  testDrivenPhase,
  testFilesChangedByChantier,
  withoutSpaces,
} from '../tdd.mjs'
import {
  findProjectRoot,
  git,
  gitPaths,
  gitRaw,
  isAncestorOfHead,
  requireConfig,
  today,
  uncommittedFiles,
} from './common.mjs'
import { requireActiveChantier } from './identifiers.mjs'
import { codeFilesSince } from './slices.mjs'
import { appendAmendment, updateSpec } from './spec.mjs'

// ---------- Test commands ----------

function uncommittedTestFiles(projectRoot, config) {
  return uncommittedFiles(projectRoot).filter((file) => matchesAny(file, config.testPaths, config.ignoreCase))
}

// Test files changed since the tests were frozen at `commit`: uncommitted ones, and committed ones
// that the chantier itself touched (its commits and the resolution of its merges, see
// codeFilesSince) with a change that merges of the default branch do not explain (see
// testFilesChangedByChantier): a test file brought or extended by such a merge, conflict included,
// does not count. When `commit` is no longer an ancestor of HEAD (rebase after the freeze), the
// chantier's history since the freeze cannot be read: the whole diff counts.
export function testFilesChangedSince(projectRoot, config, commit) {
  const isTest = (file) => matchesAny(file, config.testPaths, config.ignoreCase)
  let committed
  if (isAncestorOfHead(projectRoot, commit)) {
    const candidates = [...new Set(codeFilesSince(projectRoot, commit, 'first-parent'))].filter(isTest)
    committed = candidates.length ? committedTestChanges(projectRoot, commit, candidates) : []
  } else {
    committed = gitPaths(projectRoot, ['diff', '--name-only', '-z', commit, '--']).filter(isTest)
  }
  return [...new Set([...committed, ...uncommittedTestFiles(projectRoot, config)])]
}

// Among `candidates`, the files whose changes since `commit` are not explained by the merged
// commits (second parents of the merges since `commit`). The diff is limited to the candidates.
function committedTestChanges(projectRoot, commit, candidates) {
  const range = [commit, 'HEAD', '--', ...candidates.map((file) => `:(literal)${file}`)]
  const diff = gitRaw(projectRoot, ['-c', 'core.quotePath=false', 'diff', '--no-renames', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--ignore-all-space', '--ignore-cr-at-eol', ...range])
  const merged = git(projectRoot, ['rev-list', '--merges', `${commit}..HEAD`]).split('\n').filter(Boolean)
  const cache = new Map()
  const mergedLines = (file) => {
    if (!cache.has(file)) {
      const lines = new Set()
      for (const merge of merged) {
        let text = ''
        try {
          text = gitRaw(projectRoot, ['show', `${merge}^2:${file}`])
        } catch {
          continue // the file does not exist on that side
        }
        for (const line of text.split('\n')) lines.add(withoutSpaces(line))
      }
      cache.set(file, lines)
    }
    return cache.get(file)
  }
  return testFilesChangedByChantier(diff, mergedLines).filter((file) => candidates.includes(file))
}

// Test files present at `base` whose lines were changed or removed in HEAD (whitespace and line
// endings ignored), among the test files changed by the chantier itself since `base`: files brought
// by a merge of the default branch do not count (see codeFilesSince). Deleted files and binary files
// are taken from git's file lists, as the text diff has no removed line for an empty or binary file
// and quotes unusual paths. The diffs are limited to those files, so their size stays small.
function testFilesWithRemovedLines(projectRoot, config, base) {
  const candidates = [...new Set(codeFilesSince(projectRoot, base, 'first-parent'))]
    .filter((file) => matchesAny(file, config.testPaths, config.ignoreCase))
  if (!candidates.length) return []
  const range = [base, 'HEAD', '--', ...candidates.map((file) => `:(literal)${file}`)]
  const fromDiff = removedTestLines(gitRaw(projectRoot, ['-c', 'core.quotePath=false', 'diff', '--no-renames', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--ignore-all-space', '--ignore-cr-at-eol', ...range]))
  const deleted = gitPaths(projectRoot, ['diff', '--no-renames', '--name-only', '-z', '--diff-filter=D', ...range])
  // `--numstat -z` entries: "<added>\t<removed>\t<path>", "-" for both counts on a binary file.
  const binary = gitPaths(projectRoot, ['diff', '--no-renames', '--numstat', '-z', ...range])
    .filter((entry) => entry.startsWith('-\t-\t'))
    .map((entry) => entry.slice(4))
  return [...new Set([...fromDiff, ...deleted, ...binary])].filter((file) => candidates.includes(file))
}

// Step 3 of the TDD workflow: the tests must be committed before implementation starts.
export function commandFreezeTests() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  if (testDrivenPhase(chantier) !== 'writing-tests') {
    console.error('Ce chantier n’est pas en phase « tests d’abord ».')
    process.exit(1)
  }
  const pending = uncommittedTestFiles(projectRoot, config)
  if (pending.length) {
    console.error(`Tests non commités, impossible de les figer :\n${pending.map((file) => `- ${file}`).join('\n')}\nCommite-les d’abord.`)
    process.exit(2)
  }
  const commit = git(projectRoot, ['rev-parse', '--short', 'HEAD'])
  const lastCommitFiles = gitPaths(projectRoot, ['show', '--name-only', '-z', '--format=', 'HEAD'])
  if (!lastCommitFiles.some((file) => matchesAny(file, config.testPaths, config.ignoreCase))) {
    console.error('Le dernier commit ne contient aucun fichier de test. Commite les tests (et seulement les tests) avant de les figer.')
    process.exit(2)
  }
  const sliceBase = chantier.spec.data.slice_base || null
  const sliceBaseIsAncestor = sliceBase ? isAncestorOfHead(projectRoot, sliceBase) : null
  const removedTestFiles = sliceBase && sliceBaseIsAncestor ? testFilesWithRemovedLines(projectRoot, config, sliceBase) : []
  const refusal = freezeTestsRefusal({ chantier, sliceBaseIsAncestor, removedTestFiles })
  if (refusal) {
    console.error(`Gel refusé : ${refusal}`)
    process.exit(2)
  }
  const { specPath } = updateSpec(projectRoot, config, freezeTestsValues(chantier, commit))
  if (isRefreeze(parseAmendments(chantier.spec.body).entries)) {
    appendAmendment(specPath, refreezeTestsEntry(today(), commit))
  }
  console.log(`Tests figés au commit ${commit}. Phase suivante : implémentation, sans modifier les tests (/atelier:build).`)
}

export function commandReopenTests(reasonWords) {
  const reason = reasonWords.join(' ').trim()
  if (!reason) {
    console.error('Usage : atelier reopen-tests <raison>')
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const refusal = reopenTestsRefusal(chantier)
  if (refusal) {
    console.error(`Réouverture refusée : ${refusal}`)
    process.exit(2)
  }
  const { specPath } = updateSpec(projectRoot, config, { tests_commit: '' })
  appendAmendment(specPath, reopenTestsEntry(today(), chantier.spec.data.tests_commit || chantier.spec.data.slice_base, reason))
  console.log('Tests rouverts. Retour en phase « tests d’abord » : aucune implémentation jusqu’au prochain commit des tests.')
}

// Records the human decision on TDD. After signature, the change is traced as an amendment.
export function commandSetTdd([value, ...reasonWords]) {
  if (!['yes', 'no'].includes(value)) {
    console.error('Usage : atelier set-tdd <yes|no> [raison]')
    process.exit(1)
  }
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const refusal = setTddRefusal(chantier, value)
  if (refusal) {
    console.error(`TDD refusé : ${refusal}`)
    process.exit(2)
  }
  const wasSigned = chantier.spec.data.status === 'signed'
  const { specPath } = updateSpec(projectRoot, config, { tdd: value })
  const reason = reasonWords.join(' ').trim()
  if (wasSigned) {
    appendAmendment(specPath, `${today()} : TDD ${value === 'yes' ? 'activé' : 'désactivé'}${reason ? ` : ${reason}` : ''}`)
  }
  console.log(value === 'yes'
    ? 'Chantier en TDD : tests écrits, commités et figés avant l’implémentation.'
    : 'Chantier sans TDD : pas de phase tests d’abord imposée.')
}

export function commandTestsChanged() {
  const projectRoot = findProjectRoot()
  const config = requireConfig(projectRoot)
  const chantier = requireActiveChantier(projectRoot, config)
  const commit = chantier.spec.data.tests_commit
  if (!commit) {
    console.log('Tests pas encore figés.')
    return
  }
  const changed = testFilesChangedSince(projectRoot, config, commit)
  if (changed.length === 0) {
    console.log(`Aucun test modifié depuis le commit ${commit}.`)
    return
  }
  console.log(`Tests modifiés depuis le commit ${commit} :\n${changed.map((file) => `- ${file}`).join('\n')}`)
  process.exitCode = 2
}
