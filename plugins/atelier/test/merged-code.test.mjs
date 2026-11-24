import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { codeLogArguments, parseGitVersion } from '../lib/core.mjs'
import { atelierOk, atelierRun, commit, commitFiles, git, headOf, makeSlicedRepository, setHeader } from './helpers.mjs'

const status = (directory) => JSON.parse(atelierOk(directory, 'status', '--json'))
const reviewPattern = /Implémentation commitée : faire relire : \/atelier:review/
const staleCodePattern = /du code a été commité depuis le commit revu/

// Commits `files` on the default branch, then comes back to `branch`.
function advanceMain(directory, branch, files, subject = 'feat: main') {
  git(directory, 'switch', '-q', 'main')
  commitFiles(directory, files, subject)
  git(directory, 'switch', '-q', branch)
}

function mergeMain(directory) {
  git(directory, 'merge', '-q', '--no-edit', 'main')
}

// FIX-20 (single slice, without TDD) on fix/FIX-20-x: code committed, then the review recorded.
function reviewedFix({ beforeReview = {} } = {}) {
  const directory = makeSlicedRepository({ id: 'FIX-20', tdd: 'no', plan: null })
  commitFiles(directory, { 'src/fix.mjs': 'export const fix = 1\n', ...beforeReview }, 'fix: fix')
  setHeader(directory, 'FIX-20', { reviewed_commit: headOf(directory) })
  return directory
}

// FEAT-20 (three slices, without TDD) on feat/FEAT-20-x, in slice 2 with nothing committed yet.
function sliceTwoWithoutTdd() {
  const directory = makeSlicedRepository({ tdd: 'no' })
  commitFiles(directory, { 'src/one.mjs': 'export const one = 1\n' }, 'feat: one')
  setHeader(directory, 'FEAT-20', { slice: '2', slice_base: headOf(directory) })
  return directory
}

describe('code apporté par une fusion de la branche par défaut', () => {
  it('une fusion sans conflit de la branche par défaut ne rend pas la revue obsolète [FIX-28 CA-1]', () => {
    const directory = reviewedFix()
    advanceMain(directory, 'fix/FIX-20-x', { 'src/main.mjs': 'export const main = 1\n' })
    mergeMain(directory)
    const summary = status(directory)
    assert.equal(summary.chantier.reviewState, 'current', summary.chantier.reviewProblems.join('\n'))
    assert.doesNotMatch(atelierRun(directory, 'close-check').output, staleCodePattern)
  })

  it('un conflit résolu après la revue la rend obsolète, en ne citant que les fichiers de la résolution [FIX-28 CA-2]', () => {
    const directory = reviewedFix({ beforeReview: { 'src/shared.mjs': 'export const shared = "fix"\n' } })
    git(directory, 'switch', '-q', 'main')
    commitFiles(directory, { 'src/shared.mjs': 'export const shared = "main"\n', 'src/main.mjs': 'export const main = 1\n' }, 'feat: main')
    git(directory, 'switch', '-q', 'fix/FIX-20-x')
    const merge = gitExitStatus(directory, ['merge', '-q', '--no-edit', 'main'])
    assert.notEqual(merge, 0, 'la fusion doit être en conflit')
    writeFileSync(join(directory, 'src/shared.mjs'), 'export const shared = "both"\n')
    git(directory, 'add', '-A')
    commit(directory, 'chore(merge): main')
    const summary = status(directory)
    assert.equal(summary.chantier.reviewState, 'stale')
    const problems = summary.chantier.reviewProblems.join('\n')
    assert.match(problems, /src\/shared\.mjs/)
    assert.doesNotMatch(problems, /src\/main\.mjs/)
  })

  it('une tranche dont le seul commit est une fusion de la branche par défaut est vide [FIX-28 CA-3]', () => {
    const directory = sliceTwoWithoutTdd()
    advanceMain(directory, 'feat/FEAT-20-x', { 'src/main.mjs': 'export const main = 1\n' })
    mergeMain(directory)
    const onlyMerge = atelierRun(directory, 'set-reviewed')
    assert.notEqual(onlyMerge.status, 0, onlyMerge.output)
    assert.match(onlyMerge.output, /tranche vide/i)

    commitFiles(directory, { 'src/two.mjs': 'export const two = 2\n' }, 'feat: two')
    assert.doesNotMatch(atelierRun(directory, 'set-reviewed').output, /tranche vide/i)
  })

  it('en TDD, une fusion de la branche par défaut après le gel ne fait pas annoncer la revue [FIX-28 CA-4]', () => {
    const directory = makeSlicedRepository({ id: 'FIX-20', tdd: 'yes', plan: null })
    commitFiles(directory, { 'test/fix.test.mjs': 'test\n' }, 'test: fix')
    setHeader(directory, 'FIX-20', { tests_commit: git(directory, 'rev-parse', '--short', 'HEAD').trim(), slice: '1' })
    advanceMain(directory, 'fix/FIX-20-x', { 'src/main.mjs': 'export const main = 1\n' })
    mergeMain(directory)
    const summary = status(directory)
    assert.equal(summary.chantier.codeCommitted, false)
    assert.doesNotMatch(summary.nextStep, reviewPattern)
    assert.match(summary.nextStep, /Implémenter/)
  })

  it('les commits d’un main local en avance sur origin/main ne comptent pas [FIX-28 CA-5]', () => {
    const withRemote = (directory, branch) => {
      git(directory, 'update-ref', 'refs/remotes/origin/main', 'main')
      advanceMain(directory, branch, { 'src/local.mjs': 'export const local = 1\n' }, 'feat: local')
      mergeMain(directory)
    }
    const reviewed = reviewedFix()
    withRemote(reviewed, 'fix/FIX-20-x')
    const summary = status(reviewed)
    assert.equal(summary.chantier.reviewState, 'current', summary.chantier.reviewProblems.join('\n'))

    const slice = sliceTwoWithoutTdd()
    withRemote(slice, 'feat/FEAT-20-x')
    const result = atelierRun(slice, 'set-reviewed')
    assert.notEqual(result.status, 0, result.output)
    assert.match(result.output, /tranche vide/i)
  })

  it('lit la version de git et ne prend le nouveau calcul qu’à partir de 2.36 [FIX-28 CA-6]', () => {
    for (const [text, newCalculation] of [
      ['git version 2.35.1', false],
      ['git version 2.31.0', false],
      ['git version 1.99.9', false],
      ['git version 2.36.0', true],
      ['git version 2.39.3 (Apple Git-146)', true],
      ['git version 2.45.1.windows.1', true],
      ['git version 3.0.0', true],
    ]) {
      const version = parseGitVersion(text)
      assert.notEqual(version, null, text)
      const args = codeLogArguments({ from: 'abc', gitVersion: version, excludedRefs: ['origin/main', 'main'], fallbackDiffMerges: 'first-parent' })
      assert.equal(args.includes('--diff-merges=remerge'), newCalculation, text)
      assert.equal(args.includes('^origin/main') && args.includes('^main'), newCalculation, text)
    }
    for (const text of ['', 'pas une version', 'git version', 'git version x.y']) {
      assert.equal(parseGitVersion(text), null, JSON.stringify(text))
    }
    const legacy = ['log', '--name-only', '-z', '--no-renames', '--diff-merges=first-parent', '--format=', 'abc..HEAD']
    assert.deepEqual(codeLogArguments({ from: 'abc', gitVersion: null, excludedRefs: ['main'], fallbackDiffMerges: 'first-parent' }), legacy, 'version illisible')
    assert.deepEqual(
      codeLogArguments({ from: 'abc', gitVersion: parseGitVersion('git version 2.35.1'), excludedRefs: ['main'], fallbackDiffMerges: null }),
      ['log', '--name-only', '-z', '--no-renames', '--format=', 'abc..HEAD'],
      'repli de la tranche',
    )
  })

  it('sans référence à exclure, le calcul actuel s’applique sans erreur [FIX-28 CA-7]', () => {
    const noDefault = reviewedFix()
    git(noDefault, 'branch', '-m', 'main', 'trunk')
    commitFiles(noDefault, { 'src/after.mjs': 'export const after = 1\n' }, 'fix: after')

    const alreadyMerged = reviewedFix()
    commitFiles(alreadyMerged, { 'src/after.mjs': 'export const after = 1\n' }, 'fix: after')
    git(alreadyMerged, 'branch', '-f', 'main', 'HEAD')

    for (const [label, directory] of [['sans branche par défaut', noDefault], ['branche déjà fusionnée dans main', alreadyMerged]]) {
      const summary = status(directory)
      assert.equal(summary.chantier.reviewState, 'stale', label)
      assert.match(summary.chantier.reviewProblems.join('\n'), /src\/after\.mjs/, label)
    }
    assert.deepEqual(
      codeLogArguments({ from: 'abc', gitVersion: parseGitVersion('git version 2.43.0'), excludedRefs: [], fallbackDiffMerges: 'first-parent' }),
      ['log', '--name-only', '-z', '--no-renames', '--diff-merges=first-parent', '--format=', 'abc..HEAD'],
      'aucune référence à exclure',
    )
  })

  it('une branche fusionnée dans main puis reprise garde le code commité après la revue [FIX-28 CA-8]', () => {
    const directory = reviewedFix()
    commitFiles(directory, { 'src/after.mjs': 'export const after = 1\n' }, 'fix: after')
    git(directory, 'switch', '-q', 'main')
    git(directory, 'merge', '-q', '--no-ff', '--no-edit', 'fix/FIX-20-x')
    git(directory, 'switch', '-q', 'fix/FIX-20-x')
    commitFiles(directory, { 'docs/chantiers/FIX-20-x/notes.md': 'notes\n' }, 'docs: notes')
    const summary = status(directory)
    assert.equal(summary.chantier.reviewState, 'stale')
    assert.match(summary.chantier.reviewProblems.join('\n'), /src\/after\.mjs/)
  })

  it('une retouche sans conflit dans le commit de fusion rend la revue obsolète, sans citer le reste de main [FIX-28 CA-9]', () => {
    const directory = reviewedFix()
    advanceMain(directory, 'fix/FIX-20-x', { 'src/main.mjs': 'export const main = 1\n' })
    git(directory, 'merge', '-q', '--no-commit', '--no-ff', 'main')
    writeFileSync(join(directory, 'src/fix.mjs'), 'export const fix = 2\n')
    git(directory, 'add', '-A')
    commit(directory, 'chore(merge): main')
    const summary = status(directory)
    assert.equal(summary.chantier.reviewState, 'stale')
    const problems = summary.chantier.reviewProblems.join('\n')
    assert.match(problems, /src\/fix\.mjs/)
    assert.doesNotMatch(problems, /src\/main\.mjs/)
  })
})

// Exit status of a git command expected to fail (a conflicting merge).
function gitExitStatus(directory, gitArguments) {
  try {
    git(directory, ...gitArguments)
    return 0
  } catch (error) {
    return error.status ?? 1
  }
}
