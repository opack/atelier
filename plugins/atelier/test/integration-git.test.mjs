import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { atelierOk, atelierRun, commit, commitFiles, epicPlan, git, headOf, makeRepository, planOf, setHeader, writeChantier } from './helpers.mjs'

const EPIC_BRANCH = 'epic/EPIC-1-x'
const REMOTE_EPIC = `refs/remotes/origin/${EPIC_BRANCH}`
const twoSlices = planOf([1, 2])
const status = (directory) => JSON.parse(atelierOk(directory, 'status', '--json'))

// main, then the integration branch of EPIC-1 (option on) where a sibling FIX-4 delivered code.
function integrationRepository() {
  const directory = makeRepository('main')
  git(directory, 'switch', '-q', '-c', EPIC_BRANCH)
  writeChantier(directory, { id: 'EPIC-1', relations: { integration_branch: 'yes' }, files: epicPlan })
  git(directory, 'add', '-A')
  commit(directory, 'docs(chantiers): [EPIC-1] spec')
  deliverSibling(directory, 'FIX-4', { 'src/sibling.mjs': 'export const sibling = 1\n' }, EPIC_BRANCH)
  return directory
}

// A sibling `id` delivers `files` into the integration branch (merge commit), then `back` is checked out.
function deliverSibling(directory, id, files, back) {
  git(directory, 'switch', '-q', EPIC_BRANCH)
  git(directory, 'switch', '-q', '-c', `fix/${id}-x`)
  commitFiles(directory, files, `fix(sibling): [${id}] deliver`)
  git(directory, 'switch', '-q', EPIC_BRANCH)
  git(directory, 'merge', '-q', '--no-ff', '--no-edit', `fix/${id}-x`)
  git(directory, 'switch', '-q', back)
}

// FEAT-2 (without TDD), child of EPIC-1, on `branch` started from the integration branch.
function childBranch(directory, { branch = 'feat/FEAT-2-x', plan = twoSlices } = {}) {
  git(directory, 'switch', '-q', '-c', branch, EPIC_BRANCH)
  writeChantier(directory, { id: 'FEAT-2', tdd: 'no', relations: { rel_parent: 'EPIC-1' }, files: plan === null ? {} : { 'plan.md': plan } })
  git(directory, 'add', '-A')
  commit(directory, 'docs(chantiers): [FEAT-2] spec')
  return branch
}

// The integration branch only as a remote-tracking branch (as after a clone).
function onlyRemote(directory) {
  git(directory, 'update-ref', REMOTE_EPIC, EPIC_BRANCH)
  git(directory, 'branch', '-q', '-D', EPIC_BRANCH)
}

function emptySliceRefusal(directory) {
  const result = atelierRun(directory, 'set-reviewed')
  assert.notEqual(result.status, 0, result.output)
  assert.match(result.output, /tranche vide/i)
}

function gitStatus(directory, gitArguments) {
  return spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...gitArguments], { cwd: directory }).status
}

// git with fixed author and committer dates, so that the order of commits by date is known.
function gitAt(directory, date, ...gitArguments) {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...gitArguments], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

describe('code of a child counted from the integration branch', () => {
  it('tranche 1 d’un enfant : le code d’un frère fusionné dans la branche d’intégration ne compte pas [FEAT-21 AC-7]', () => {
    const directory = integrationRepository()
    childBranch(directory)
    assert.equal(status(directory).chantier.codeCommitted, false)
    emptySliceRefusal(directory)

    commitFiles(directory, { 'src/own.mjs': 'export const own = 1\n' }, 'feat(own): [FEAT-2] own code')
    assert.equal(status(directory).chantier.codeCommitted, true)
    const result = atelierRun(directory, 'set-reviewed')
    assert.equal(result.status, 0, result.output)
  })

  it('tranche 1 : la branche d’intégration fusionnée de nouveau dans l’enfant n’apporte pas de code propre [FEAT-21 AC-7]', () => {
    const directory = integrationRepository()
    const branch = childBranch(directory)
    deliverSibling(directory, 'FIX-5', { 'src/later.mjs': 'export const later = 1\n' }, branch)
    git(directory, 'merge', '-q', '--no-edit', EPIC_BRANCH)
    emptySliceRefusal(directory)
  })
})

describe('git reference of the integration branch', () => {
  it('seulement distante : la branche de suivi sert de base [FEAT-21 AC-6]', () => {
    const directory = integrationRepository()
    childBranch(directory)
    onlyRemote(directory)
    emptySliceRefusal(directory)
  })

  it('locale en retard sur la distante : la distante sert de base [FEAT-21 AC-6]', () => {
    const directory = integrationRepository()
    const branch = childBranch(directory)
    const before = git(directory, 'rev-parse', EPIC_BRANCH).trim()
    deliverSibling(directory, 'FIX-5', { 'src/later.mjs': 'export const later = 1\n' }, branch)
    git(directory, 'update-ref', REMOTE_EPIC, EPIC_BRANCH)
    git(directory, 'branch', '-q', '-f', EPIC_BRANCH, before)
    git(directory, 'merge', '-q', '--no-edit', REMOTE_EPIC)
    emptySliceRefusal(directory)
  })

  it('distante en retard sur la locale : la locale sert de base [FEAT-21 AC-6]', () => {
    const directory = integrationRepository()
    const branch = childBranch(directory)
    git(directory, 'update-ref', REMOTE_EPIC, EPIC_BRANCH)
    deliverSibling(directory, 'FIX-5', { 'src/later.mjs': 'export const later = 1\n' }, branch)
    git(directory, 'merge', '-q', '--no-edit', EPIC_BRANCH)
    emptySliceRefusal(directory)
  })

  it('locale et distante divergentes : arrêt qui demande de synchroniser la branche, sans repli [FEAT-21 AC-6]', () => {
    const directory = integrationRepository()
    const branch = childBranch(directory)
    commitFiles(directory, { 'src/own.mjs': 'export const own = 1\n' }, 'feat(own): [FEAT-2] own code')
    git(directory, 'switch', '-q', EPIC_BRANCH)
    commit(directory, 'docs(chantiers): [EPIC-1] remote side')
    git(directory, 'update-ref', REMOTE_EPIC, 'HEAD')
    git(directory, 'reset', '-q', '--hard', 'HEAD~1')
    commit(directory, 'docs(chantiers): [EPIC-1] local side')
    git(directory, 'switch', '-q', branch)
    const result = atelierRun(directory, 'set-reviewed')
    assert.notEqual(result.status, 0, result.output)
    assert.match(result.output, /epic\/EPIC-1-x/)
    assert.match(result.output, /synchronise/i)
  })

  it('ni locale ni distante : arrêt qui demande de récupérer ou pousser la branche, sans repli [FEAT-21 AC-6]', () => {
    const directory = integrationRepository()
    childBranch(directory)
    commitFiles(directory, { 'src/own.mjs': 'export const own = 1\n' }, 'feat(own): [FEAT-2] own code')
    git(directory, 'branch', '-q', '-D', EPIC_BRANCH)
    const result = atelierRun(directory, 'set-reviewed')
    assert.notEqual(result.status, 0, result.output)
    assert.match(result.output, /epic\/EPIC-1-x/)
    assert.match(result.output, /récupère|pousse/i)
  })
})

describe('active chantier read from the commits of a branch without identifier', () => {
  it('les commits plus récents apportés par une fusion de la branche d’intégration ne passent pas devant ceux de la branche [FEAT-21 AC-13]', () => {
    const directory = integrationRepository()
    gitAt(directory, '2030-01-01T00:00:10Z', 'switch', '-q', '-c', 'claude/session-x', EPIC_BRANCH)
    writeChantier(directory, { id: 'FEAT-2', status: 'draft', tdd: 'yes', relations: { rel_parent: 'EPIC-1' } })
    git(directory, 'add', '-A')
    gitAt(directory, '2030-01-01T00:00:10Z', 'commit', '-q', '-m', 'docs(chantiers): [FEAT-2] spec draft')
    git(directory, 'switch', '-q', EPIC_BRANCH)
    gitAt(directory, '2030-01-01T00:00:20Z', 'commit', '-q', '--allow-empty', '-m', 'docs(chantiers): [EPIC-1] note')
    git(directory, 'switch', '-q', '-c', 'fix/FIX-5-x')
    gitAt(directory, '2030-01-01T00:00:30Z', 'commit', '-q', '--allow-empty', '-m', 'fix(sibling): [FIX-5] deliver')
    git(directory, 'switch', '-q', EPIC_BRANCH)
    gitAt(directory, '2030-01-01T00:00:40Z', 'merge', '-q', '--no-ff', '--no-edit', 'fix/FIX-5-x')
    git(directory, 'switch', '-q', 'claude/session-x')
    gitAt(directory, '2030-01-01T00:00:50Z', 'merge', '-q', '--no-edit', EPIC_BRANCH)
    const summary = status(directory)
    assert.equal(summary.chantier.id, 'FEAT-2')
    assert.equal(summary.chantierSource, 'commits')
  })
})

describe('integration branch merged into a reviewed child', () => {
  // FEAT-2 (single slice, without TDD) with its own code reviewed.
  function reviewedChild(ownFiles = {}) {
    const directory = integrationRepository()
    const branch = childBranch(directory, { plan: null })
    commitFiles(directory, { 'src/own.mjs': 'export const own = 1\n', ...ownFiles }, 'feat(own): [FEAT-2] own code')
    setHeader(directory, 'FEAT-2', { reviewed_commit: headOf(directory) })
    return { directory, branch }
  }

  it('sans conflit, la revue reste à jour [FEAT-21 AC-15]', () => {
    const { directory, branch } = reviewedChild()
    deliverSibling(directory, 'FIX-5', { 'src/later.mjs': 'export const later = 1\n' }, branch)
    git(directory, 'merge', '-q', '--no-edit', EPIC_BRANCH)
    const summary = status(directory)
    assert.equal(summary.chantier.reviewState, 'current', summary.chantier.reviewProblems.join('\n'))
  })

  it('avec un conflit résolu sur du code, la revue est périmée et ne cite que les fichiers résolus [FEAT-21 AC-15]', () => {
    const { directory, branch } = reviewedChild({ 'src/shared.mjs': 'export const shared = "child"\n' })
    deliverSibling(directory, 'FIX-5', { 'src/shared.mjs': 'export const shared = "sibling"\n', 'src/later.mjs': 'export const later = 1\n' }, branch)
    assert.notEqual(gitStatus(directory, ['merge', '-q', '--no-edit', EPIC_BRANCH]), 0, 'la fusion doit être en conflit')
    writeFileSync(join(directory, 'src/shared.mjs'), 'export const shared = "both"\n')
    git(directory, 'add', '-A')
    commit(directory, 'chore(merge): [FEAT-2] merge integration branch')
    const summary = status(directory)
    assert.equal(summary.chantier.reviewState, 'stale')
    const problems = summary.chantier.reviewProblems.join('\n')
    assert.match(problems, /src\/shared\.mjs/)
    assert.doesNotMatch(problems, /src\/later\.mjs/)
  })
})

describe('tests brought by a merge of the integration branch', () => {
  it('un test commun modifié par un frère et apporté par une fusion de la branche d’intégration ne bloque pas le gel de l’enfant [FEAT-21 AC-15]', () => {
    const directory = makeRepository('main')
    git(directory, 'switch', '-q', '-c', EPIC_BRANCH)
    writeChantier(directory, { id: 'EPIC-1', relations: { integration_branch: 'yes' }, files: epicPlan })
    commitFiles(directory, { 'test/shared.test.mjs': 'ligne a\nligne b\n' }, 'docs(chantiers): [EPIC-1] spec')
    const branch = 'feat/FEAT-2-x'
    git(directory, 'switch', '-q', '-c', branch, EPIC_BRANCH)
    writeChantier(directory, { id: 'FEAT-2', tdd: 'yes', relations: { rel_parent: 'EPIC-1' }, files: { 'plan.md': twoSlices } })
    commitFiles(directory, { 'test/one.test.mjs': 'un\n', 'src/one.mjs': 'export const one = 1\n' }, 'feat(one): [FEAT-2] slice 1')
    setHeader(directory, 'FEAT-2', { slice: '2', slice_base: headOf(directory) })
    deliverSibling(directory, 'FIX-5', { 'test/shared.test.mjs': 'ligne a\nligne b modifiée par le frère\n' }, branch)
    git(directory, 'merge', '-q', '--no-edit', EPIC_BRANCH)
    commitFiles(directory, { 'test/two.test.mjs': 'deux\n' }, 'test(two): [FEAT-2] add failing tests for AC-2')
    const result = atelierRun(directory, 'freeze-tests')
    assert.equal(result.status, 0, result.output)
  })
})

describe('tests changed since the freeze, with the integration branch merged', () => {
  it('un test commun modifié par un frère n’est pas cité ; retouché par l’enfant, il l’est [FEAT-21 AC-15]', () => {
    const directory = makeRepository('main')
    git(directory, 'switch', '-q', '-c', EPIC_BRANCH)
    writeChantier(directory, { id: 'EPIC-1', relations: { integration_branch: 'yes' }, files: epicPlan })
    commitFiles(directory, { 'test/shared.test.mjs': 'ligne a\nligne b\n' }, 'docs(chantiers): [EPIC-1] spec')
    const branch = 'feat/FEAT-2-x'
    git(directory, 'switch', '-q', '-c', branch, EPIC_BRANCH)
    writeChantier(directory, { id: 'FEAT-2', tdd: 'yes', relations: { rel_parent: 'EPIC-1' }, files: { 'plan.md': twoSlices } })
    commitFiles(directory, { 'test/one.test.mjs': 'un\n' }, 'test(one): [FEAT-2] add failing tests for AC-1')
    atelierOk(directory, 'freeze-tests')
    git(directory, 'add', '-A')
    commit(directory, 'docs(chantiers): [FEAT-2] freeze tests')
    deliverSibling(directory, 'FIX-5', { 'test/shared.test.mjs': 'ligne a\nligne b modifiée par le frère\n' }, branch)
    git(directory, 'merge', '-q', '--no-edit', EPIC_BRANCH)
    assert.doesNotMatch(atelierOk(directory, 'tests-changed'), /shared\.test\.mjs/)

    commitFiles(directory, { 'test/shared.test.mjs': 'ligne a\nligne b modifiée par l’enfant\n' }, 'test(shared): [FEAT-2] touch')
    const changed = atelierRun(directory, 'tests-changed')
    assert.match(changed.output, /shared\.test\.mjs/)
  })
})
